import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TransactionType } from '@prisma/client'; // o definilo aparte

export class CreateTransactionDto {
  @IsEnum(TransactionType, { message: 'type must be one of: INCOME, EXPENSE, SAVING' })
  type!: TransactionType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;
}
