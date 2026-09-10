import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

// `@nestjs/typeorm`'s published build is ESM-only and cannot be parsed by the
// CommonJS Jest transform configured for this project. `ProjectsService` only
// uses `InjectRepository` as a parameter decorator, so a no-op stub is safe here.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { Project } from './project.entity';
import { ProjectsService } from './projects.service';

interface MockProjectRepository {
  findOne: jest.Mock<
    Promise<Project | null>,
    [{ where: { name: string } | { id: string } }]
  >;
  find: jest.Mock<Promise<Project[]>, [{ order: { createdAt: 'DESC' } }]>;
  create: jest.Mock<Partial<Project>, [Partial<Project>]>;
  save: jest.Mock<Promise<Project>, [Partial<Project>]>;
}

function createMockRepository(): MockProjectRepository {
  return {
    findOne: jest.fn<
      Promise<Project | null>,
      [{ where: { name: string } | { id: string } }]
    >(),
    find: jest.fn<Promise<Project[]>, [{ order: { createdAt: 'DESC' } }]>(),
    create: jest.fn<Partial<Project>, [Partial<Project>]>((data) => data),
    save: jest.fn<Promise<Project>, [Partial<Project>]>((data) =>
      Promise.resolve(data as Project),
    ),
  };
}

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: MockProjectRepository;

  beforeEach(() => {
    repository = createMockRepository();
    service = new ProjectsService(repository as unknown as Repository<Project>);
  });

  describe('create', () => {
    it('creates and persists a project owned by the requesting user', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.create(
        { name: 'code-sentinel', repo: 'git@github.com:org/code-sentinel.git' },
        'user-1',
      );

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: 'code-sentinel' },
      });
      expect(repository.create).toHaveBeenCalledWith({
        name: 'code-sentinel',
        repo: 'git@github.com:org/code-sentinel.git',
        userId: 'user-1',
      });
      expect(result).toMatchObject({ name: 'code-sentinel', userId: 'user-1' });
    });

    it('trims surrounding whitespace before persisting', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.create(
        { name: '  code-sentinel  ', repo: '  git@github.com:org/repo.git  ' },
        'user-1',
      );

      expect(repository.create).toHaveBeenCalledWith({
        name: 'code-sentinel',
        repo: 'git@github.com:org/repo.git',
        userId: 'user-1',
      });
    });

    it('rejects a project name that is already registered', async () => {
      repository.findOne.mockResolvedValue({
        id: 'existing',
        name: 'code-sentinel',
      } as Project);

      await expect(
        service.create(
          { name: 'code-sentinel', repo: 'git@github.com:org/repo.git' },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns projects ordered by most recently created', async () => {
      const projects = [{ id: 'project-1' }] as Project[];
      repository.find.mockResolvedValue(projects);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(projects);
    });
  });

  describe('findById', () => {
    it('returns the matching project', async () => {
      const project = { id: 'project-1', name: 'code-sentinel' } as Project;
      repository.findOne.mockResolvedValue(project);

      const result = await service.findById('project-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
      expect(result).toBe(project);
    });

    it('throws when the project does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the repo and tools of an existing project', async () => {
      const project = {
        id: 'project-1',
        name: 'code-sentinel',
        repo: 'git@github.com:org/old.git',
        tools: ['SAST'],
      } as Project;
      repository.findOne.mockResolvedValue(project);

      const result = await service.update('project-1', {
        repo: '  git@github.com:org/new.git  ',
        tools: ['SAST', 'Secret Scanner'],
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'project-1',
          repo: 'git@github.com:org/new.git',
          tools: ['SAST', 'Secret Scanner'],
        }),
      );
      expect(result).toMatchObject({
        repo: 'git@github.com:org/new.git',
        tools: ['SAST', 'Secret Scanner'],
      });
    });

    it('leaves fields untouched when they are not provided', async () => {
      const project = {
        id: 'project-1',
        name: 'code-sentinel',
        repo: 'git@github.com:org/repo.git',
        tools: ['SAST', 'Port Scanner'],
      } as Project;
      repository.findOne.mockResolvedValue(project);

      await service.update('project-1', {});

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: 'git@github.com:org/repo.git',
          tools: ['SAST', 'Port Scanner'],
        }),
      );
    });

    it('throws when the project does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { repo: 'git@github.com:org/repo.git' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
