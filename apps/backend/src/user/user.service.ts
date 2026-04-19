import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface IUser {
  id: number;
  email: string;
  hash: string;
  fullName: string | null;
  createdAt: Date;
  updatedAt: Date;
  refreshToken: string | null;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    const user: IUser | null = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const safeUser = {
      id: user?.id,
      email: user?.email,
      fullName: user?.fullName,
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
}
