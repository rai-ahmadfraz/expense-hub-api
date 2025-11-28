import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from 'src/users/dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async signIn(loginUserDto: LoginUserDto): Promise<{
    access_token: string;
    id: number;
    name: string;
    email: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginUserDto.email },
    });

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(
      loginUserDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw new BadRequestException('Invalid credentials');
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}
