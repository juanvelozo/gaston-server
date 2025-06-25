import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthService } from 'src/auth/auth.service';

export interface IUser {
  id: number;
  email: string;
  hash: string;
  fullName: string | null;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  refreshToken: string | null;
}
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async getProfile(userId: number) {
    const user: IUser | null = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const safeUser = {
      id: user?.id,
      email: user?.email,
      fullName: user?.fullName,
      profileImage: user?.profileImage ?? null,
      createdAt: user?.createdAt,
    };
    return safeUser;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const pwMatches = await bcrypt.compare(dto.currentPassword, user.hash);
    if (!pwMatches) {
      throw new ForbiddenException('Contraseña actual incorrecta');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hash: newHash },
    });
    const tokens = await this.authService.getTokens(user.id, user.email);
    await this.authService.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return tokens;
  }
}
