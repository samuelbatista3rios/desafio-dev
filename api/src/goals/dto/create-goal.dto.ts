import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({ example: 'Viagem para Europa' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @IsString()
  name: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive({ message: 'Valor alvo deve ser positivo' })
  targetAmount: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}
