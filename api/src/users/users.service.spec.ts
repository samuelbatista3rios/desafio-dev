import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

const mockUser: Partial<User> = {
  id: 'uuid-1',
  email: 'test@email.com',
  name: 'Test User',
  password: 'hashed_password',
};

const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar um usuário com senha hasheada', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      const result = await service.create({
        name: 'Test User',
        email: 'test@email.com',
        password: '123456',
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@email.com' },
      });
      expect(result).not.toHaveProperty('password');
    });

    it('deve lançar ConflictException se e-mail já existe', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create({
          name: 'Test',
          email: 'test@email.com',
          password: '123456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByEmail', () => {
    it('deve retornar usuário pelo e-mail', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@email.com');
      expect(result).toEqual(mockUser);
    });

    it('deve retornar null se usuário não encontrado', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('naoexiste@email.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('deve retornar usuário pelo id sem a senha', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('uuid-1');
      expect(result).not.toHaveProperty('password');
    });

    it('deve lançar NotFoundException se usuário não encontrado', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('uuid-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
