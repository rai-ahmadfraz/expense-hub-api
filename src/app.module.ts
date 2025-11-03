import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseModule } from './expense/expense.module';
@Module({
  imports: [AuthModule, UsersModule,
    TypeOrmModule.forRoot({
       type: 'mysql',

      // ===== LOCAL DEVELOPMENT =====
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: 'splitit_db',

      // ===== PRODUCTION (Railway) =====
      // url: "mysql://root:oKizfCJWqJmUIMeQMFmNzukDcRJfHcxT@mysql.railway.internal:3306/railway", // Railway variable: ${{ MySQL.MYSQL_URL }}

      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Disable in production if you want safer migrations
      // logging: true, // optional
    }),
    ExpenseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
