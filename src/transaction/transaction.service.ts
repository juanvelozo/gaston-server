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

  /**
   * Crea una nueva transacción para el usuario proporcionado.
   * @param userId - ID del usuario que realiza la transacción.
   * @param dto - Data Transfer Object que contiene los datos de la nueva transacción.
   * @returns La transacción recién creada.
   */
  async create(userId: number, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        ...dto,
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        userId,
      },
    });
  }

  /**
   * Obtiene todas las transacciones de un usuario específico.
   * @param userId - ID del usuario cuyas transacciones se desean obtener.
   * @returns Lista de transacciones ordenadas por fecha de creación, de más reciente a más antigua.
   */
  async findAll(userId: number) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        user: {
          select: {
            fullName: true,
            profileImage: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene un resumen de las transacciones del usuario, agrupadas por tipo.
   * @param userId - ID del usuario cuyas transacciones se desean resumir.
   * @returns Objeto resumen con el total de ingresos, gastos y ahorros.
   */
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

  /**
   * Busca una transacción específica por su ID y usuario.
   * @param userId - ID del usuario propietario de la transacción.
   * @param id - ID de la transacción a buscar.
   * @throws NotFoundException - Si la transacción no se encuentra.
   * @returns La transacción encontrada.
   */
  async findOne(userId: number, id: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        category: true,
        user: {
          select: {
            fullName: true,
            profileImage: true,
          },
        },
      },
    });
    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }
    return transaction;
  }

  /**
   * Actualiza una transacción existente.
   * @param userId - ID del usuario propietario de la transacción.
   * @param id - ID de la transacción a actualizar.
   * @param dto - Data Transfer Object con los nuevos datos de la transacción.
   * @throws NotFoundException - Si la transacción no se encuentra.
   * @returns La transacción actualizada.
   */
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

  /**
   * Elimina una transacción existente.
   * @param userId - ID del usuario propietario de la transacción.
   * @param id - ID de la transacción a eliminar.
   * @throws NotFoundException - Si la transacción no se encuentra.
   * @returns La transacción eliminada.
   */
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
