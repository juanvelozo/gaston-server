import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { GetUser } from 'src/auth/decorator/get-user.decorator';

@Controller('transactions')
@UseGuards(JwtGuard)
export class TransactionController {
  constructor(private service: TransactionService) {}

  @Post()
  create(@GetUser() user: { sub: number; email: string }, @Body() dto: CreateTransactionDto) {
    return this.service.create(user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user: { sub: number; email: string }) {
    return this.service.findAll(user.sub);
  }

  @Get('summary')
  summary(@GetUser() user: { sub: number; email: string }) {
    return this.service.findSummary(user.sub);
  }
}
