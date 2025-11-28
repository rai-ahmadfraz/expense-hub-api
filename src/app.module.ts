import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExpenseModule } from './expense/expense.module';
import { FriendModule } from './friend/friend.module';
import { PrismaService } from './prisma/prisma.service';
@Module({
  imports: [AuthModule, UsersModule,
    ExpenseModule,
    FriendModule,
  ],
  controllers: [AppController],
  providers: [AppService,PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
