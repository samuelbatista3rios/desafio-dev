import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { DepositGoalDto } from './dto/deposit-goal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Metas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar meta' })
  @ApiResponse({ status: 201, description: 'Meta criada com sucesso' })
  create(
    @CurrentUser() user: { id: string },
    @Body() createGoalDto: CreateGoalDto,
  ) {
    return this.goalsService.create(user.id, createGoalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar metas do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de metas' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.goalsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar meta por ID' })
  @ApiResponse({ status: 200, description: 'Dados da meta' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.goalsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar meta' })
  @ApiResponse({ status: 200, description: 'Meta atualizada' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateGoalDto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, user.id, updateGoalDto);
  }

  @Patch(':id/deposit')
  @ApiOperation({ summary: 'Depositar valor na meta' })
  @ApiResponse({ status: 200, description: 'Depósito realizado' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  deposit(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() depositDto: DepositGoalDto,
  ) {
    return this.goalsService.deposit(id, user.id, depositDto.amount);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover meta' })
  @ApiResponse({ status: 200, description: 'Meta removida' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.goalsService.remove(id, user.id);
  }
}
