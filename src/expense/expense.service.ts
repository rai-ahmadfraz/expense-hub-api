import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Expense } from 'src/entities/expense.entity';
import { Repository } from 'typeorm';
import { ExpenseMember } from 'src/entities/expensemember.entity';
import { User } from 'src/entities/user.entity';
@Injectable()
export class ExpenseService {

    constructor(@InjectRepository(Expense) private expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseMember) private expenseMemberRepository: Repository<ExpenseMember>, 
    @InjectRepository(User) private userRepository: Repository<User> ) {}


    async createExpense(createExpenseDto: CreateExpenseDto, user_id: number) {
        const { name, amount, paid_id, participants, is_personal } = createExpenseDto;

        let paidId = paid_id;
        if (is_personal) paidId = user_id;

        const expense = this.expenseRepository.create({
            name,
            totalAmount: amount,
            user: { id: user_id },
            paidBy: { id: paidId },
            is_personal: is_personal || false,
        });

        try {
            // Attempt to save. DB unique constraint will prevent duplicates.
            await this.expenseRepository.save(expense);
        } catch (err: any) {
            if (err.code === 'ER_DUP_ENTRY') {
                // Handle DB-level duplicate
                throw new BadRequestException('Expense with this name already exists');
            }
            throw err;
        }

        if (participants && participants.length > 0) {
            await this.addExpenseMembers(participants, amount, expense.id);
        }

        return { message: 'Expense created successfully' };
    }


    async addExpenseMembers(participants:any,totalAmount:number,ExpenseId:number){

      let membersToInsert: ExpenseMember[] = [];

        if (participants && participants.length > 0) {
            const equalShare = totalAmount / participants.length;

            for (const p of participants) {
            let shareAmount = 0;

            if (p.share_type === 'equal') {
                shareAmount = equalShare;
            } else if (p.share_type === 'percentage') {
                shareAmount = (totalAmount * (p.share_value || 0)) / 100;
            } else if (p.share_type === 'fixed') {
                shareAmount = p.share_value || 0;
            }

            
            const member = this.expenseMemberRepository.create({
                expense: { id: ExpenseId },
                user: { id: p.id },
                shareType: p.share_type,
                shareValue: p.share_value || null,
                amountOwed: shareAmount,
            });

            membersToInsert.push(member);
            }

            await this.expenseMemberRepository.save(membersToInsert);
        }

    }

    // remove expense by expense id and user id who is the owner of that expense
    async deleteExpense(expnseId:number,userId:number){
      const expense = await this.expenseRepository.findOne({where:{id:expnseId,user:{id:userId}}});
      if(expense){
        await this.expenseMemberRepository.delete({ expense: { id: expense.id } });
        await this.expenseRepository.remove(expense);
        return { message: 'Expense deleted successfully' };
      }

      throw new BadRequestException("Invalid expense id or something went wrong");
    }

    async deleteExpenseMemberById(
      loginUserId: number,
      memberDetail: { expense_id: number; member_id: number }
    ) {
      const { expense_id, member_id } = memberDetail;

      // 🔹 Step 1: Validate member existence (if not the same as logged-in user)
      if (loginUserId !== member_id) {
        const memberExists = await this.userRepository.findOneBy({ id: member_id });
        if (!memberExists) {
          throw new BadRequestException('Invalid member ID');
        }
      }

      // 🔹 Step 2: Fetch expense and related user
      const expense = await this.expenseRepository.findOne({
        where: { id: expense_id },
        relations: ['user','paidBy'],
      });

      if (!expense) {
        throw new BadRequestException('Expense not found');
      }

      // 🔹 Step 3: Prevent deleting the admin (expense owner)
      if (expense.user?.id === member_id) {
        throw new BadRequestException("Admin can't be deleted from their own expense");
      }

      // 🔹 Step 4: Check permission
      const isOwner = loginUserId === expense.user.id;
      const isSelf = loginUserId === member_id;
      const isPaidUser = loginUserId = expense.paidBy.id;

      if (!isOwner && !isSelf && !isPaidUser) {
        throw new BadRequestException('You are not authorized to remove this member');
      }

      // 🔹 Step 5: Delete the expense member
      const deleteResult = await this.expenseMemberRepository.delete({
        expense: { id: expense.id },
        user: { id: member_id },
      });

      if (deleteResult.affected === 0) {
        throw new BadRequestException('Expense member not found or already deleted');
      }

      return { message: 'Expense member deleted successfully' };
    }

    async findExpenseByNameAndUserId(name: string, userId: number) {
        return this.expenseRepository.findOne({
            where: {
            name,
            user: { id: userId },
            }
        });
    }

    async getSummary(userId: number) {
  // 1️⃣ Who owes me (I paid)
      const owedToMe = await this.expenseMemberRepository
          .createQueryBuilder('em')
          .innerJoin('em.expense', 'expense')
          .innerJoin('em.user', 'user')
          .where('expense.paidBy = :userId', { userId })
          .andWhere('em.user != :userId', { userId })
          .andWhere('em.amountOwed > 0')
          .select([
          'user.id AS userId',
          'user.name AS userName',
          'user.email AS userEmail',
          'SUM(em.amountOwed) AS total',
          ])
          .groupBy('user.id')
          .getRawMany();

      // 2️⃣ Who I owe (they paid)
      const iOwe = await this.expenseMemberRepository
          .createQueryBuilder('em')
          .innerJoin('em.expense', 'expense')
          .innerJoin('expense.paidBy', 'payer')
          .where('em.user = :userId', { userId })
          .andWhere('expense.paidBy != :userId', { userId })
          .andWhere('em.amountOwed > 0')
          .select([
          'payer.id AS userId',
          'payer.name AS userName',
          'payer.email AS userEmail',
          'SUM(em.amountOwed) AS total',
          ])
          .groupBy('payer.id')
          .getRawMany();

      // 3️⃣ Merge both sides (calculate net balance)
      const balanceMap = new Map<number, { userId: number; userName: string; balance: number,userEmail: string; }>();

      for (const o of owedToMe) {
          balanceMap.set(Number(o.userId), {
          userId: Number(o.userId),
          userName: o.userName,
          userEmail: o.userEmail,
          balance: Number(o.total),
          });
      }

      for (const o of iOwe) {
          const existing = balanceMap.get(Number(o.userId));
          if (existing) {
          existing.balance -= Number(o.total);
          } else {
          balanceMap.set(Number(o.userId), {
              userId: Number(o.userId),
              userName: o.userName,
              userEmail: o.userEmail,
              balance: -Number(o.total),
          });
          }
      }

      // 4️⃣ Create array with status
      const users = Array.from(balanceMap.values()).map(b => ({
          ...b,
          status:
          b.balance > 0
              ? 'owes you'
              : b.balance < 0
              ? 'you owe'
              : 'settled',
      }));

      // 5️⃣ Compute overall net balance
      const overall = users.reduce((sum, d) => sum + d.balance, 0);

      const overallStatus =
          overall > 0
          ? `You are owed ${overall.toFixed(2)}`
          : overall < 0
          ? `You owe ${Math.abs(overall).toFixed(2)}`
          : 'All settled!';

      return {
          summary: {
          netBalance: overall,
          overallStatus,
          },
          users,
      };
    }

async getExpensesWithFriend(userId: number, friendId: number) {
  const memberExists = await this.userRepository.findOneBy({id:friendId});
  if(!memberExists){
    throw new BadRequestException("Invalid friend id");
  }
  // 1️⃣ Fetch all expenses involving either userId or friendId
  const expenses = await this.expenseMemberRepository
    .createQueryBuilder('em')
    .innerJoinAndSelect('em.expense', 'expense')
    .innerJoinAndSelect('expense.paidBy', 'payer')
    .innerJoinAndSelect('em.user', 'member')
    .where(
      '(expense.paidBy = :userId AND em.user = :friendId) OR (expense.paidBy = :friendId AND em.user = :userId)',
      { userId, friendId }
    )
    .select([
      'expense.id AS "expenseId"',
      'expense.name AS "title"',
      'expense.total_amount AS "totalAmount"',
      'expense.paid_id AS "paidById"',
      'payer.name AS "paidByName"',
      'em.user_id AS "memberId"',
      'member.name AS "memberName"',
      'em.amount_owed AS "amountOwed"',
      'expense.created_at AS "createdAt"',
    ])
    .orderBy('expense.created_at', 'DESC')
    .getRawMany();

  // 2️⃣ Get unique expense IDs
  const expenseIds = expenses.map(e => e.expenseId);

  if (expenseIds.length === 0) {
    return {
      summary: { netBalance: 0, overallStatus: 'No shared expenses' },
      expenses: [],
    };
  }

  // 3️⃣ Fetch ALL members for those expenses
  const allMembers = await this.expenseMemberRepository
    .createQueryBuilder('em')
    .innerJoin('em.user', 'user')
    .where('em.expense_id IN (:...expenseIds)', { expenseIds })
    .select([
      'em.expense_id AS "expenseId"',
      'user.id AS "userId"',
      'user.name AS "userName"',
      'em.amount_owed AS "amountOwed"',
    ])
    .getRawMany();

  // 4️⃣ Group members by expenseId
  const memberMap = allMembers.reduce((map, m) => {
    if (!map[m.expenseId]) map[m.expenseId] = [];
    map[m.expenseId].push({
      userId: Number(m.userId),
      name: m.userName,
      amount: Number(m.amountOwed),
    });
    return map;
  }, {} as Record<number, { userId: number; name: string; amount: number }[]>);

  // 5️⃣ Format final expenses list
  const formatted = expenses.map(e => ({
    expenseId: e.expenseId,
    title: e.title,
    totalAmount: Number(e.totalAmount),
    paidBy: {
      userId: e.paidById,
      name: e.paidByName,
    },
    owes: {
      userId: e.memberId,
      name: e.memberName,
      amount: Number(e.amountOwed),
    },
    members: memberMap[e.expenseId] || [],
    createdAt: e.createdAt,
    status:
      e.paidById === userId
        ? 'owes you'
        : 'you owe',
  }));

  // 6️⃣ Compute net balance between you and the friend
  const netBalance = formatted.reduce((sum, e) => {
    return e.paidBy.userId === userId ? sum + e.owes.amount : sum - e.owes.amount;
  }, 0);

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
