import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './transaction.entity';

const userId = 'user-uuid-1';
const otherUserId = 'other-user-uuid';

const mockTransaction: Partial<Transaction> = {
  id: 'tx-uuid-1',
  description: 'Salário',
  amount: 3500,
  type: TransactionType.INCOME,
  date: new Date('2024-01-15'),
  userId,
};

const mockIncome: Partial<Transaction> = {
  ...mockTransaction,
  type: TransactionType.INCOME,
  amount: 3500,
};

const mockExpense: Partial<Transaction> = {
  id: 'tx-uuid-2',
  description: 'Aluguel',
  amount: 1200,
  type: TransactionType.EXPENSE,
  date: new Date('2024-01-10'),
  userId,
};


function makeQueryBuilder(transactions: Partial<Transaction>[]) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(transactions),
  };
  return qb;
}

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
  });

  
  describe('create', () => {
    it('deve criar uma transação associada ao userId', async () => {
      mockRepository.create.mockReturnValue(mockTransaction);
      mockRepository.save.mockResolvedValue(mockTransaction);

      const dto = {
        description: 'Salário',
        amount: 3500,
        type: TransactionType.INCOME,
        date: '2024-01-15',
      };

      const result = await service.create(userId, dto as any);

      expect(mockRepository.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTransaction);
    });
  });

 
  describe('findAll', () => {
    it('deve retornar resumo com totalIncome, totalExpense e balance', async () => {
      const qb = makeQueryBuilder([mockIncome, mockExpense]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(userId);

      expect(result.totalIncome).toBe(3500);
      expect(result.totalExpense).toBe(1200);
      expect(result.balance).toBe(2300);
      expect(result.transactions).toHaveLength(2);
    });

    it('deve aplicar filtro de tipo via andWhere', async () => {
      const qb = makeQueryBuilder([mockIncome]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(userId, { type: TransactionType.INCOME });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'transaction.type = :type',
        { type: TransactionType.INCOME },
      );
    });

    it('deve aplicar filtro de datas via andWhere', async () => {
      const qb = makeQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(userId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'transaction.date >= :startDate',
        { startDate: '2024-01-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'transaction.date <= :endDate',
        { endDate: '2024-01-31' },
      );
    });

    it('deve retornar balance zero quando não há transações', async () => {
      const qb = makeQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(userId);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpense).toBe(0);
      expect(result.balance).toBe(0);
    });

    it('deve aplicar filtro de categoria via andWhere', async () => {
      const qb = makeQueryBuilder([mockExpense]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(userId, { categoryId: 'cat-uuid-1' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'transaction.categoryId = :categoryId',
        { categoryId: 'cat-uuid-1' },
      );
    });

    it('deve somar corretamente múltiplas transações do mesmo tipo', async () => {
      const secondIncome: Partial<Transaction> = {
        ...mockIncome,
        id: 'tx-uuid-3',
        amount: 1500,
      };
      const qb = makeQueryBuilder([mockIncome, secondIncome as Transaction, mockExpense]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(userId);

      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpense).toBe(1200);
      expect(result.balance).toBe(3800);
    });
  });

 
  describe('findOne', () => {
    it('deve retornar a transação quando encontrada e pertence ao usuário', async () => {
      mockRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOne('tx-uuid-1', userId);
      expect(result).toEqual(mockTransaction);
    });

    it('deve lançar NotFoundException se transação não existir', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nao-existe', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar ForbiddenException se transação pertence a outro usuário', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        userId: otherUserId,
      });

      await expect(service.findOne('tx-uuid-1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  
  describe('update', () => {
    it('deve atualizar a transação e retornar o resultado salvo', async () => {
      const updated = { ...mockTransaction, description: 'Salário atualizado' };
      mockRepository.findOne.mockResolvedValue({ ...mockTransaction });
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.update(
        'tx-uuid-1',
        userId,
        { description: 'Salário atualizado' } as any,
      );

      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.description).toBe('Salário atualizado');
    });

    it('deve lançar NotFoundException ao atualizar transação inexistente', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nao-existe', userId, { description: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException ao atualizar transação de outro usuário', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        userId: otherUserId,
      });

      await expect(
        service.update('tx-uuid-1', userId, { description: 'x' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  
  describe('remove', () => {
    it('deve remover a transação do usuário', async () => {
      mockRepository.findOne.mockResolvedValue(mockTransaction);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(service.remove('tx-uuid-1', userId)).resolves.not.toThrow();
      expect(mockRepository.remove).toHaveBeenCalledWith(mockTransaction);
    });

    it('deve lançar NotFoundException ao remover transação inexistente', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nao-existe', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar ForbiddenException ao remover transação de outro usuário', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        userId: otherUserId,
      });

      await expect(service.remove('tx-uuid-1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
