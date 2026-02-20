import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService, TransactionFilters } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType } from './transaction.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Movimentações')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar movimentação' })
  @ApiResponse({ status: 201, description: 'Movimentação criada com sucesso' })
  create(
    @CurrentUser() user: { id: string },
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(user.id, createTransactionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar movimentações com resumo financeiro' })
  @ApiResponse({ status: 200, description: 'Lista de movimentações e resumo' })
  @ApiQuery({ name: 'type', required: false, enum: TransactionType })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2024-12-31' })
  findAll(
    @CurrentUser() user: { id: string },
    @Query('type') type?: TransactionType,
    @Query('categoryId') categoryId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: TransactionFilters = { type, categoryId, startDate, endDate };
    return this.transactionsService.findAll(user.id, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar movimentação por ID' })
  @ApiResponse({ status: 200, description: 'Dados da movimentação' })
  @ApiResponse({ status: 404, description: 'Movimentação não encontrada' })
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.transactionsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar movimentação' })
  @ApiResponse({ status: 200, description: 'Movimentação atualizada' })
  @ApiResponse({ status: 404, description: 'Movimentação não encontrada' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, user.id, updateTransactionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover movimentação' })
  @ApiResponse({ status: 200, description: 'Movimentação removida' })
  @ApiResponse({ status: 404, description: 'Movimentação não encontrada' })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.transactionsService.remove(id, user.id);
  }
}
