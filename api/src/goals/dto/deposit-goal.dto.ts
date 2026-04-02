import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class DepositGoalDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive({ message: 'Valor deve ser positivo' })
  amount: number;
}
