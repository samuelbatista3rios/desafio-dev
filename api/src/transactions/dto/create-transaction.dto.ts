import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransactionType } from '../transaction.entity';

export class CreateTransactionDto {
  @ApiProperty({ example: 'Salário mensal' })
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  @IsString()
  description: string;

  @ApiProperty({ example: 3500.0 })
  @IsNumber({}, { message: 'Valor deve ser um número' })
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.INCOME })
  @IsEnum(TransactionType, { message: 'Tipo deve ser income ou expense' })
  type: TransactionType;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString({}, { message: 'Data inválida' })
  date: string;

  @ApiPropertyOptional({ example: 'Pagamento referente ao mês de janeiro' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'uuid-da-categoria' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de categoria inválido' })
  categoryId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: 'monthly', enum: ['monthly', 'weekly', 'yearly'] })
  @IsOptional()
  @IsIn(['monthly', 'weekly', 'yearly'])
  recurringFrequency?: string;
}
