// src/auth/auth.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ForbiddenException('El email ya está registrado');
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        hash,
        fullName: dto.fullName,
      },
    });

    return this.signToken(user.id, user.email);
  }

  async signin(dto: SigninDto) {
    const user: User | null = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.hash)))
      throw new ForbiddenException('Credenciales incorrectas');

    const pwMatches = await bcrypt.compare(dto.password, user.hash);

    if (!pwMatches) throw new ForbiddenException('Credenciales incorrectas');

    return this.signToken(user.id, user.email);
  }

  async signToken(userId: number, email: string): Promise<{ access_token: string }> {
    const payload = { sub: userId, email };

    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    return { access_token: token };
  }
}
