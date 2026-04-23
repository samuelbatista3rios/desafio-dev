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

  async applyRecurring(userId: string, year: number, month: number): Promise<{ created: number }> {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const lastDayPrev = new Date(prevYear, prevMonth, 0).getDate();
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${lastDayPrev}`;

    const recurring = await this.transactionsRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .andWhere('t.isRecurring = true')
      .andWhere('t.date >= :start', { start: prevStart })
      .andWhere('t.date <= :end', { end: prevEnd })
      .getMany();

    const targetStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayTarget = new Date(year, month, 0).getDate();
    const targetEnd = `${year}-${String(month).padStart(2, '0')}-${lastDayTarget}`;

    const existing = await this.transactionsRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .andWhere('t.isRecurring = true')
      .andWhere('t.date >= :start', { start: targetStart })
      .andWhere('t.date <= :end', { end: targetEnd })
      .select('t.description')
      .getMany();

    const existingDescriptions = new Set(existing.map((t) => t.description));
    let created = 0;

    for (const tx of recurring) {
      if (existingDescriptions.has(tx.description)) continue;
      const origDay = new Date(tx.date).getUTCDate();
      const day = Math.min(origDay, lastDayTarget);
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      await this.transactionsRepository.save(
        this.transactionsRepository.create({
          userId,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          categoryId: tx.categoryId,
          notes: tx.notes,
          isRecurring: true,
          recurringFrequency: tx.recurringFrequency,
          date,
        }),
      );
      created++;
    }

    return { created };
  }
}
