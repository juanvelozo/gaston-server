import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: number) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: number, id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id, userId },
      include: {
        transactions: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return category;
  }

  async update(userId: number, id: number, dto: UpdateCategoryDto) {
    // Verificamos que la categoría exista y pertenezca al usuario
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: number, id: number) {
    // Verificamos que la categoría exista y pertenezca al usuario
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }
}
