import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from './goal.entity';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalsRepository: Repository<Goal>,
  ) {}

  async create(userId: string, createGoalDto: CreateGoalDto): Promise<Goal> {
    const goal = this.goalsRepository.create({
      ...createGoalDto,
      userId,
    });
    return this.goalsRepository.save(goal);
  }

  async findAll(userId: string): Promise<Goal[]> {
    return this.goalsRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Goal> {
    const goal = await this.goalsRepository.findOne({ where: { id } });

    if (!goal) {
      throw new NotFoundException('Meta não encontrada');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('Sem permissão para acessar esta meta');
    }

    return goal;
  }

  async update(id: string, userId: string, updateGoalDto: UpdateGoalDto): Promise<Goal> {
    const goal = await this.findOne(id, userId);
    Object.assign(goal, updateGoalDto);
    return this.goalsRepository.save(goal);
  }

  async deposit(id: string, userId: string, amount: number): Promise<Goal> {
    const goal = await this.findOne(id, userId);
    goal.currentAmount = Number(goal.currentAmount) + Number(amount);
    return this.goalsRepository.save(goal);
  }

  async remove(id: string, userId: string): Promise<void> {
    const goal = await this.findOne(id, userId);
    await this.goalsRepository.remove(goal);
  }
}
