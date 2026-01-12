import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Expense } from './expense.entity';
import { ExpenseMember } from './expensemember.entity';
import { Friend } from './friend.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255, select: false })
  password: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, default: "USD" })
  currency: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Expenses created by this user
  @OneToMany(() => Expense, (expense) => expense.user)
  createdExpenses: Expense[];

  // Expenses this user paid for
  @OneToMany(() => Expense, (expense) => expense.paidBy)
  paidExpenses: Expense[];

  // Expenses where this user is a participant
  @OneToMany(() => ExpenseMember, (expenseMember) => expenseMember.user)
  expenseMemberships: ExpenseMember[];


  // Create friend by this user
  @OneToMany(() => Friend, (friend) => friend.user)
  createdFriends: Friend[];

  //friend request this user make
  @OneToMany(() => Friend, (friend) => friend.friend)
  friendRequest: Friend[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}
