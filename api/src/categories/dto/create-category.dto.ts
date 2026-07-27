import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Alimentação' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Gastos com refeições e mercado' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 800, description: 'Teto de gastos mensal' })
  @IsOptional()
  @IsNumber({}, { message: 'Orçamento deve ser um número' })
  @IsPositive({ message: 'Orçamento deve ser positivo' })
  monthlyBudget?: number;
}
