import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

interface Summary {
  [key: string]: number;
  income: number;
  expense: number;
  saving: number;
}

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: number) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSummary(userId: number) {
    const summary = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    });

    return summary.reduce(
      (acc: Summary, curr) => {
        acc[curr.type.toLowerCase()] = curr._sum.amount || 0;
        return acc;
      },
      { income: 0, expense: 0, saving: 0 },
    );
  }

  async findOne(userId: number, id: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }
    return transaction;
  }

  async update(userId: number, id: number, dto: UpdateTransactionDto) {
    // Validar que la transacción exista y pertenezca al usuario
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    return this.prisma.transaction.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: number, id: number) {
    // Validar que la transacción exista y pertenezca al usuario
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
