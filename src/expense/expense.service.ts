import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

  // -------------------------
  // Create Expense
  // -------------------------
  async createExpense(createExpenseDto: CreateExpenseDto, userId: number) {
    const { name, amount, paid_id, participants, is_personal } = createExpenseDto;
    const paidId = is_personal ? userId : paid_id;

    try {
      const expense = await this.prisma.expense.create({
        data: {
          name,
          totalAmount: amount,
          isPersonal: is_personal || false,
          userId,
          paidById: paidId || null,
        },
      });

      if (participants && participants.length > 0) {
        await this.addExpenseMembers(participants, amount, expense.id);
      }

      return { message: 'Expense created successfully' };
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new BadRequestException('Expense with this name already exists');
      }
      throw err;
    }
  }

  // -------------------------
  // Add Expense Members
  // -------------------------
  async addExpenseMembers(participants: any[], totalAmount: number, expenseId: number) {
    const membersToInsert = participants.map(p => {
      let shareAmount = 0;

      if (p.share_type === 'equal') shareAmount = totalAmount / participants.length;
      else if (p.share_type === 'percentage') shareAmount = (totalAmount * (p.share_value || 0)) / 100;
      else if (p.share_type === 'fixed') shareAmount = p.share_value || 0;

      return {
        expenseId,
        userId: p.id,
        shareType: p.share_type,
        shareValue: p.share_value || null,
        amountOwed: shareAmount,
      };
    });

    if (membersToInsert.length > 0) {
      await this.prisma.expenseMember.createMany({
        data: membersToInsert,
        skipDuplicates: true,
      });
    }
  }

  // -------------------------
  // Delete Expense
  // -------------------------
  async deleteExpense(expenseId: number, userId: number) {
    const expense = await this.prisma.expense.findFirst({ where: { id: expenseId, userId } });
    if (!expense) throw new BadRequestException('Invalid expense id or something went wrong');

    await this.prisma.expenseMember.deleteMany({ where: { expenseId } });
    await this.prisma.expense.delete({ where: { id: expenseId } });

    return { message: 'Expense deleted successfully' };
  }

  // -------------------------
  // Delete Expense Member
  // -------------------------
  async deleteExpenseMemberById(
    loginUserId: number,
    memberDetail: { expense_id: number; member_id: number },
  ) {
    const { expense_id, member_id } = memberDetail;

    if (loginUserId !== member_id) {
      const memberExists = await this.prisma.user.findUnique({ where: { id: member_id } });
      if (!memberExists) throw new BadRequestException('Invalid member ID');
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: expense_id },
    });

    if (!expense) throw new BadRequestException('Expense not found');
    if (expense.userId === member_id) throw new BadRequestException("Admin can't be deleted");

    const isOwner = loginUserId === expense.userId;
    const isSelf = loginUserId === member_id;
    const isPaidUser = loginUserId === expense.paidById;

    if (!isOwner && !isSelf && !isPaidUser) {
      throw new BadRequestException('You are not authorized to remove this member');
    }

    const deleteResult = await this.prisma.expenseMember.deleteMany({
      where: { expenseId: expense.id, userId: member_id },
    });

    if (deleteResult.count === 0) throw new BadRequestException('Expense member not found');

    return { message: 'Expense member deleted successfully' };
  }

  // -------------------------
  // Find expense by name and user
  // -------------------------
  async findExpenseByNameAndUserId(name: string, userId: number) {
    return this.prisma.expense.findFirst({ where: { name, userId } });
  }

  // -------------------------
  // Get Summary
  // -------------------------
  async getSummary(userId: number) {
    // Who owes me
    const owedAgg = await this.prisma.expenseMember.groupBy({
      by: ['userId'],
      where: { expense: { paidById: userId }, userId: { not: userId }, amountOwed: { gt: 0 } },
      _sum: { amountOwed: true },
    });

    const userIds = owedAgg.map(o => o.userId);
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });

    const owedToMe = owedAgg.map(o => {
      const user = users.find(u => u.id === o.userId);
      return {
        userId: o.userId,
        userName: user?.name,
        userEmail: user?.email,
        balance: o._sum.amountOwed || 0,
      };
    });

    // Who I owe
    const iOweAgg = await this.prisma.expenseMember.groupBy({
      by: ['expenseId'],
      where: { userId, amountOwed: { gt: 0 }, expense: { paidById: { not: userId } } },
      _sum: { amountOwed: true },
    });

    const payerIds = iOweAgg.map(i => i.expenseId);
    const expenses = await this.prisma.expense.findMany({
      where: { id: { in: payerIds } },
      include: { paidBy: true },
    });

    const iOwe = iOweAgg.map(i => {
      const expense = expenses.find(e => e.id === i.expenseId);
      return {
        userId: expense?.paidById,
        userName: expense?.paidBy?.name,
        userEmail: expense?.paidBy?.email,
        balance: -(i._sum.amountOwed || 0),
      };
    });

    const combined = [...owedToMe, ...iOwe];

    const usersSummary = combined.map(u => ({
      userId: u.userId,
      userName: u.userName,
      userEmail: u.userEmail,
      balance: u.balance,
      status: Number(u.balance) > 0 ? 'owes you' : Number(u.balance) < 0 ? 'you owe' : 'settled',
    }));

    const overall = usersSummary.reduce((sum, u) => sum + Number(u.balance), 0);
    const overallStatus =
      overall > 0 ? `You are owed ${overall.toFixed(2)}` : overall < 0 ? `You owe ${Math.abs(overall).toFixed(2)}` : 'All settled!';

    return { summary: { netBalance: overall, overallStatus }, users: usersSummary };
  }

  // -------------------------
  // Get Expenses With Friend
  // -------------------------
  async getExpensesWithFriend(userId: number, friendId: number) {
    const memberExists = await this.prisma.user.findUnique({ where: { id: friendId } });
    if (!memberExists) throw new BadRequestException('Invalid friend id');

    const expenses = await this.prisma.expenseMember.findMany({
      where: {
        OR: [
          { expense: { paidById: userId }, userId: friendId },
          { expense: { paidById: friendId }, userId },
        ],
      },
      include: {
        expense: { include: { paidBy: true } },
        user: true,
      },
      orderBy: { expense: { createdAt: 'desc' } },
    });

    const formatted = expenses.map(e => ({
      expenseId: e.expenseId,
      title: e.expense.name,
      totalAmount: Number(e.expense.totalAmount),
      paidBy: {
        userId: e.expense.paidById,
        name: e.expense.paidBy?.name,
      },
      owes: {
        userId: e.userId,
        name: e.user.name,
        amount: Number(e.amountOwed),
      },
      members: [], // Optional: fetch members separately if needed
      createdAt: e.expense.createdAt,
      status: e.expense.paidById === userId ? 'owes you' : 'you owe',
    }));

    const netBalance = formatted.reduce(
      (sum, e) => (e.paidBy.userId === userId ? sum + e.owes.amount : sum - e.owes.amount),
      0,
    );

    return {
      summary: {
        netBalance,
        overallStatus:
          netBalance > 0
            ? `You are owed ${netBalance.toFixed(2)}`
            : netBalance < 0
            ? `You owe ${Math.abs(netBalance).toFixed(2)}`
            : 'Settled',
      },
      expenses: formatted,
    };
  }
}
