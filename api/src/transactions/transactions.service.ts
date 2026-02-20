import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType } from './transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactions: Transaction[];
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
  ) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    const transaction = this.transactionsRepository.create({
      ...createTransactionDto,
      userId,
    });
    return this.transactionsRepository.save(transaction);
  }

  async findAll(userId: string, filters: TransactionFilters = {}): Promise<TransactionSummary> {
    const query = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.category', 'category')
      .where('transaction.userId = :userId', { userId })
      .orderBy('transaction.date', 'DESC');

    if (filters.type) {
      query.andWhere('transaction.type = :type', { type: filters.type });
    }

    if (filters.categoryId) {
      query.andWhere('transaction.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.startDate) {
      query.andWhere('transaction.date >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('transaction.date <= :endDate', { endDate: filters.endDate });
    }

    const transactions = await query.getMany();

    const totalIncome = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + Number(t.amount), 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactions,
    };
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!transaction) {
      throw new NotFoundException('Movimentação não encontrada');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException('Sem permissão para acessar esta movimentação');
    }

    return transaction;
  }

  async update(id: string, userId: string, updateTransactionDto: UpdateTransactionDto): Promise<Transaction> {
    const transaction = await this.findOne(id, userId);
    Object.assign(transaction, updateTransactionDto);
    return this.transactionsRepository.save(transaction);
  }

  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.findOne(id, userId);
    await this.transactionsRepository.remove(transaction);
  }
}
