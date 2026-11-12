// apps/backend/src/users/users.service.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ObjectLiteral, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const USER_REPOSITORY_TOKEN = 'UserRepository';

type MockRepository<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('UsersService & UsersController', (): void => {
  let service: UsersService;
  let controller: UsersController;
  let repository: MockRepository<User>;

  const sampleUser: User = {
    id: 'u1',
    email: 'analyst@code-sentinel.local',
    name: 'Analyst User',
    passwordHash: '$2b$12$hashed',
    role: UserRole.ANALYST,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  beforeEach(async (): Promise<void> => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entity: Partial<User>): Partial<User> => ({
        ...entity,
      })),
      save: jest.fn((entity: Partial<User>): Promise<User> =>
        Promise.resolve({ ...sampleUser, ...entity }),
      ),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: USER_REPOSITORY_TOKEN, useValue: repository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    controller = module.get<UsersController>(UsersController);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('UsersService', (): void => {
    it('create debe guardar el usuario en minúsculas y lanzar ConflictException si el email ya existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValueOnce(null);
      const created = await service.create(
        {
          email: 'New@Code-Sentinel.local',
          name: 'New User',
          password: 'Password1!',
        },
        'hashed-pw',
      );
      expect(created.email).toBe('new@code-sentinel.local');
      expect(created.role).toBe(UserRole.ANALYST);

      repository.findOne!.mockResolvedValueOnce(sampleUser);
      await expect(
        service.create(
          {
            email: 'analyst@code-sentinel.local',
            name: 'Duplicate',
            password: 'Password1!',
          },
          'hashed-pw',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('findAll debe retornar usuarios sin passwordHash', async (): Promise<void> => {
      repository.find!.mockResolvedValue([sampleUser]);
      const users = await service.findAll();
      expect(users).toHaveLength(1);
      expect(users[0]).not.toHaveProperty('passwordHash');
    });

    it('update debe actualizar email, nombre, rol y password, y manejar 404 / 409', async (): Promise<void> => {
      repository.findOne!.mockResolvedValueOnce(null);
      await expect(
        service.update('missing', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);

      repository
        .findOne!.mockResolvedValueOnce({ ...sampleUser })
        .mockResolvedValueOnce({ ...sampleUser, id: 'u2' });
      await expect(
        service.update('u1', { email: 'taken@code-sentinel.local' }),
      ).rejects.toThrow(ConflictException);

      repository
        .findOne!.mockResolvedValueOnce({ ...sampleUser })
        .mockResolvedValueOnce(null);
      const updated = await service.update('u1', {
        email: 'Updated@code-sentinel.local',
        name: 'Updated Name',
        role: UserRole.ADMIN,
        password: 'NewPassword1!',
      });
      expect(updated.email).toBe('updated@code-sentinel.local');
      expect(updated.name).toBe('Updated Name');
      expect(updated.role).toBe(UserRole.ADMIN);
      expect(updated).not.toHaveProperty('passwordHash');
    });

    it('remove debe eliminar por id o lanzar NotFoundException si no existe', async (): Promise<void> => {
      repository.delete!.mockResolvedValueOnce({ affected: 0 });
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );

      repository.delete!.mockResolvedValueOnce({ affected: 1 });
      await expect(service.remove('u1')).resolves.toBeUndefined();
    });
  });

  describe('UsersController', (): void => {
    it('debe delegar findAll, create, update y remove en UsersService', async (): Promise<void> => {
      repository.find!.mockResolvedValue([sampleUser]);
      expect(await controller.findAll()).toHaveLength(1);

      repository.findOne!.mockResolvedValueOnce(null);
      const created = await controller.create({
        email: 'admin2@code-sentinel.local',
        name: 'Admin 2',
        password: 'Password1!',
        role: UserRole.ADMIN,
      });
      expect(created).not.toHaveProperty('passwordHash');

      repository.findOne!.mockResolvedValueOnce({ ...sampleUser });
      const updated = await controller.update('u1', { name: 'Renamed' });
      expect(updated.name).toBe('Renamed');

      repository.delete!.mockResolvedValueOnce({ affected: 1 });
      await expect(controller.remove('u1')).resolves.toBeUndefined();
    });
  });
});
