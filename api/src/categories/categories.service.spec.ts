import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

const userId = 'user-uuid-1';

const mockCategory: Partial<Category> = {
  id: 'cat-uuid-1',
  name: 'Alimentação',
  userId,
};

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar uma categoria associada ao usuário', async () => {
      mockRepository.create.mockReturnValue(mockCategory);
      mockRepository.save.mockResolvedValue(mockCategory);

      const result = await service.create(userId, { name: 'Alimentação' });

      expect(mockRepository.create).toHaveBeenCalledWith({
        name: 'Alimentação',
        userId,
      });
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('deve retornar apenas categorias do usuário', async () => {
      mockRepository.find.mockResolvedValue([mockCategory]);

      const result = await service.findAll(userId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('deve retornar categoria por id', async () => {
      mockRepository.findOne.mockResolvedValue(mockCategory);

      const result = await service.findOne('cat-uuid-1', userId);
      expect(result).toEqual(mockCategory);
    });

    it('deve lançar NotFoundException se categoria não existir', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nao-existe', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar ForbiddenException se categoria pertence a outro usuário', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockCategory,
        userId: 'outro-user',
      });

      await expect(service.findOne('cat-uuid-1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('deve remover categoria do usuário', async () => {
      mockRepository.findOne.mockResolvedValue(mockCategory);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(service.remove('cat-uuid-1', userId)).resolves.not.toThrow();
      expect(mockRepository.remove).toHaveBeenCalledWith(mockCategory);
    });
  });
});
