import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { RecurringFrequency, TransactionType } from '../transaction.entity';

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

  @ApiPropertyOptional({ example: false, description: 'Se a movimentação já foi paga' })
  @IsOptional()
  @IsBoolean({ message: 'isPaid deve ser booleano' })
  isPaid?: boolean;

  @ApiPropertyOptional({ example: '2024-02-10', description: 'Data de vencimento' })
  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate?: string;

  @ApiPropertyOptional({ example: false, description: 'Se a movimentação se repete' })
  @IsOptional()
  @IsBoolean({ message: 'isRecurring deve ser booleano' })
  isRecurring?: boolean;

  @ApiPropertyOptional({ enum: RecurringFrequency, description: 'Frequência da recorrência' })
  @IsOptional()
  @IsEnum(RecurringFrequency, { message: 'Frequência deve ser weekly, monthly ou yearly' })
  recurringFrequency?: RecurringFrequency;
}
