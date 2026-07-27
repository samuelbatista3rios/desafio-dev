import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  RecurringFrequency,
  Transaction,
  TransactionType,
} from './transaction.entity';
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
      // Recorrência sem frequência assume mensal
      recurringFrequency: createTransactionDto.isRecurring
        ? (createTransactionDto.recurringFrequency ?? RecurringFrequency.MONTHLY)
        : null,
      userId,
    });
    return this.transactionsRepository.save(transaction);
  }

  /** Avança uma data (YYYY-MM-DD) de acordo com a frequência. */
  private advanceDate(dateStr: string, freq: RecurringFrequency): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    if (freq === RecurringFrequency.WEEKLY) {
      d.setUTCDate(d.getUTCDate() + 7);
    } else if (freq === RecurringFrequency.YEARLY) {
      d.setUTCFullYear(d.getUTCFullYear() + 1);
    } else {
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  }

  /**
   * Materializa as ocorrências recorrentes até hoje. Cada "cabeça" de série
   * (isRecurring=true, sem pai) gera instâncias filhas normais para cada
   * período já vencido que ainda não exista.
   */
  private async materializeRecurring(userId: string): Promise<void> {
    const heads = await this.transactionsRepository.find({
      where: { userId, isRecurring: true, recurringParentId: IsNull() },
    });
    if (heads.length === 0) return;

    const today = new Date().toISOString().split('T')[0];

    for (const head of heads) {
      if (!head.recurringFrequency) continue;

      const occurrences = await this.transactionsRepository.find({
        where: [{ id: head.id }, { recurringParentId: head.id }],
        select: ['id', 'date'],
      });
      let last = String(head.date);
      for (const o of occurrences) {
        const od = String(o.date);
        if (od > last) last = od;
      }

      const toCreate: Transaction[] = [];
      let next = this.advanceDate(last, head.recurringFrequency);
      let guard = 0;
      while (next <= today && guard < 500) {
        toCreate.push(
          this.transactionsRepository.create({
            description: head.description,
            amount: head.amount,
            type: head.type,
            date: new Date(next + 'T12:00:00Z'),
            notes: head.notes,
            categoryId: head.categoryId,
            userId,
            dueDate: head.dueDate ? new Date(next + 'T12:00:00Z') : null,
            isPaid: false,
            isRecurring: false,
            recurringFrequency: null,
            recurringParentId: head.id,
          }),
        );
        next = this.advanceDate(next, head.recurringFrequency);
        guard++;
      }

      if (toCreate.length > 0) {
        await this.transactionsRepository.save(toCreate);
      }
    }
  }

  async findAll(userId: string, filters: TransactionFilters = {}): Promise<TransactionSummary> {
    await this.materializeRecurring(userId);

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
