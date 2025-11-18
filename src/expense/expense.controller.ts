import { BadRequestException, Body,Delete, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';

@Controller('expenses')
@UseGuards(AuthGuard)
export class ExpenseController {

    constructor(private expenseService: ExpenseService) {}

    @Post()
    createExpense(@Body() createExpenseDto:CreateExpenseDto,@Req() req: Request) {
        if (!createExpenseDto.is_personal && !createExpenseDto.paid_id) {
            throw new BadRequestException('Payer Id is required when expense is not personal');
        }
        else if (!createExpenseDto.is_personal && (!createExpenseDto.participants || createExpenseDto.participants.length === 0)) {
            throw new BadRequestException('Participants are required when expense is not personal');
        }
        return this.expenseService.createExpense(createExpenseDto,req.user.id);
    }

    @Get('summary')
    getSummary(@Req() req: Request){
        return this.expenseService.getSummary(req.user.id);
    }

    @Get('member/:memberId')
    getExpensesWithFriend(@Req() req: Request, @Param('memberId') memberId: number) {
        const userId = req.user.id;
        if(userId == memberId){
            throw new BadRequestException('Wrong friend id');
        }
        return this.expenseService.getExpensesWithFriend(userId, memberId);
    }

    @Delete(':id')
    deleteExpenseById(@Req() req: Request, @Param('id') id: number){
       return this.expenseService.deleteExpense(id,req.user.id);
    }

    @Post('delete-expense-member')
    deleteExpenseMemberById(@Req() req: Request, @Body() memberDetail:{expense_id:number,member_id:number}){
        if (!memberDetail.expense_id || !memberDetail.member_id) {
            throw new BadRequestException('expense_id and member_id are required');
        }
        return this.expenseService.deleteExpenseMemberById(req.user.id,memberDetail);
    }

}
