import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { GetUser } from '../auth/decorator/get-user.decorator';

@Controller('transactions')
@UseGuards(JwtGuard)
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  @Post()
  create(@GetUser('sub') userId: number, @Body() dto: CreateTransactionDto) {
    return this.service.create(userId, dto);
  }

  @Get()
  findAll(@GetUser('sub') userId: number) {
    return this.service.findAll(userId);
  }

  @Get('summary')
  summary(@GetUser('sub') userId: number) {
    return this.service.findSummary(userId);
  }

  // Nuevo endpoint: obtener transacción por ID
  @Get(':id')
  findOne(@GetUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(userId, id);
  }

  // Nuevo endpoint: actualizar transacción
  @Patch(':id')
  update(
    @GetUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  // Nuevo endpoint: eliminar transacción
  @Delete(':id')
  remove(@GetUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(userId, id);
  }
}
