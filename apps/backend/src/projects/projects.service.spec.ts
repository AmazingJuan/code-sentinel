import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

// `@nestjs/typeorm`'s published build is ESM-only and cannot be parsed by the
// CommonJS Jest transform configured for this project. `ProjectsService` only
// uses `InjectRepository` as a parameter decorator, so a no-op stub is safe here.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { ProjectAssignment } from './project-assignment.entity';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';
import { RequestingUser } from '../types/requesting-user.type';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

interface MockProjectRepository {
  findOne: jest.Mock<
    Promise<Project | null>,
    [{ where: { name: string } | { id: string } }]
  >;
  find: jest.Mock<Promise<Project[]>, [unknown]>;
  create: jest.Mock<Partial<Project>, [Partial<Project>]>;
  save: jest.Mock<Promise<Project>, [Partial<Project>]>;
}

interface MockAssignmentRepository {
  findOne: jest.Mock<Promise<ProjectAssignment | null>, [unknown]>;
  find: jest.Mock<Promise<ProjectAssignment[]>, [unknown]>;
  create: jest.Mock<Partial<ProjectAssignment>, [Partial<ProjectAssignment>]>;
  save: jest.Mock<Promise<ProjectAssignment>, [Partial<ProjectAssignment>]>;
  delete: jest.Mock<Promise<{ affected?: number | null }>, [unknown]>;
}

interface MockUsersService {
  findById: jest.Mock<Promise<User | null>, [string]>;
  toPublicUser: jest.Mock<Omit<User, 'passwordHash'>, [User]>;
}

function createMockProjectRepository(): MockProjectRepository {
  return {
    findOne: jest.fn<
      Promise<Project | null>,
      [{ where: { name: string } | { id: string } }]
    >(),
    find: jest.fn<Promise<Project[]>, [unknown]>(),
    create: jest.fn<Partial<Project>, [Partial<Project>]>((data) => data),
    save: jest.fn<Promise<Project>, [Partial<Project>]>((data) =>
      Promise.resolve(data as Project),
    ),
  };
}

function createMockAssignmentRepository(): MockAssignmentRepository {
  return {
    findOne: jest.fn<Promise<ProjectAssignment | null>, [unknown]>(),
    find: jest.fn<Promise<ProjectAssignment[]>, [unknown]>(),
    create: jest.fn<Partial<ProjectAssignment>, [Partial<ProjectAssignment>]>(
      (data) => data,
    ),
    save: jest.fn<Promise<ProjectAssignment>, [Partial<ProjectAssignment>]>(
      (data) => Promise.resolve(data as ProjectAssignment),
    ),
    delete: jest.fn<Promise<{ affected?: number | null }>, [unknown]>(),
  };
}

function createMockUsersService(): MockUsersService {
  return {
    findById: jest.fn<Promise<User | null>, [string]>(),
    toPublicUser: jest.fn<Omit<User, 'passwordHash'>, [User]>((user) => {
      const publicUser: Partial<User> = { ...user };
      delete publicUser.passwordHash;
      return publicUser as Omit<User, 'passwordHash'>;
    }),
  };
}

const admin: RequestingUser = { id: 'admin-1', role: UserRole.ADMIN };
const analyst: RequestingUser = { id: 'analyst-1', role: UserRole.ANALYST };

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectsRepository: MockProjectRepository;
  let assignmentsRepository: MockAssignmentRepository;
  let usersService: MockUsersService;

  beforeEach(() => {
    projectsRepository = createMockProjectRepository();
    assignmentsRepository = createMockAssignmentRepository();
    usersService = createMockUsersService();
    service = new ProjectsService(
      projectsRepository as unknown as Repository<Project>,
      assignmentsRepository as unknown as Repository<ProjectAssignment>,
      usersService as unknown as UsersService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates and persists a project owned by the requesting user, and assigns the registrant', async () => {
      projectsRepository.findOne.mockResolvedValue(null);
      const project = {
        id: 'project-1',
        name: 'code-sentinel',
        userId: 'user-1',
      } as Project;
      projectsRepository.save.mockResolvedValue(project);

      const result = await service.create(
        { name: 'code-sentinel', repo: 'git@github.com:org/code-sentinel.git' },
        'user-1',
      );

      expect(projectsRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'code-sentinel' },
      });
      expect(projectsRepository.create).toHaveBeenCalledWith({
        name: 'code-sentinel',
        repo: 'git@github.com:org/code-sentinel.git',
        userId: 'user-1',
      });
      expect(assignmentsRepository.create).toHaveBeenCalledWith({
        projectId: 'project-1',
        userId: 'user-1',
      });
      expect(assignmentsRepository.save).toHaveBeenCalled();
      expect(result).toBe(project);
    });

    it('trims surrounding whitespace before persisting', async () => {
      projectsRepository.findOne.mockResolvedValue(null);
      projectsRepository.save.mockResolvedValue({ id: 'project-1' } as Project);

      await service.create(
        { name: '  code-sentinel  ', repo: '  git@github.com:org/repo.git  ' },
        'user-1',
      );

      expect(projectsRepository.create).toHaveBeenCalledWith({
        name: 'code-sentinel',
        repo: 'git@github.com:org/repo.git',
        userId: 'user-1',
      });
    });

    it('rejects a project name that is already registered', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'existing',
        name: 'code-sentinel',
      } as Project);

      await expect(
        service.create(
          { name: 'code-sentinel', repo: 'git@github.com:org/repo.git' },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(projectsRepository.save).not.toHaveBeenCalled();
      expect(assignmentsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns every project for an administrator', async () => {
      const projects = [{ id: 'project-1' }] as Project[];
      projectsRepository.find.mockResolvedValue(projects);

      const result = await service.findAll(admin);

      expect(projectsRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(projects);
    });

    it('returns only the assigned projects for a non-administrator', async () => {
      assignmentsRepository.find.mockResolvedValue([
        { projectId: 'project-1' } as ProjectAssignment,
      ]);
      const projects = [{ id: 'project-1' }] as Project[];
      projectsRepository.find.mockResolvedValue(projects);

      const result = await service.findAll(analyst);

      expect(assignmentsRepository.find).toHaveBeenCalledWith({
        where: { userId: analyst.id },
      });
      const call = projectsRepository.find.mock.calls[0]?.[0] as {
        where?: { id?: unknown };
      };
      expect(call.where?.id).toBeDefined();
      expect(result).toBe(projects);
    });

    it('returns an empty list without querying when the user has no assignments', async () => {
      assignmentsRepository.find.mockResolvedValue([]);

      const result = await service.findAll(analyst);

      expect(projectsRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the matching project for an administrator', async () => {
      const project = { id: 'project-1', name: 'code-sentinel' } as Project;
      projectsRepository.findOne.mockResolvedValue(project);

      const result = await service.findById('project-1', admin);

      expect(result).toBe(project);
    });

    it('returns the project for a user assigned to it', async () => {
      const project = { id: 'project-1', name: 'code-sentinel' } as Project;
      projectsRepository.findOne.mockResolvedValue(project);
      assignmentsRepository.find.mockResolvedValue([
        { projectId: 'project-1' } as ProjectAssignment,
      ]);

      const result = await service.findById('project-1', analyst);

      expect(result).toBe(project);
    });

    it('throws Forbidden for a user who is not assigned to the project', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      assignmentsRepository.find.mockResolvedValue([]);

      await expect(
        service.findById('project-1', analyst),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the project does not exist', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the repo and tools of an existing project for an administrator', async () => {
      const project = {
        id: 'project-1',
        name: 'code-sentinel',
        repo: 'git@github.com:org/old.git',
        tools: ['SAST'],
      } as Project;
      projectsRepository.findOne.mockResolvedValue(project);

      const result = await service.update(
        'project-1',
        {
          repo: '  git@github.com:org/new.git  ',
          tools: ['SAST', 'Secret Scanner'],
        },
        admin,
      );

      expect(projectsRepository.save).toHaveBeenCalledWith(
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
      projectsRepository.findOne.mockResolvedValue(project);

      await service.update('project-1', {}, admin);

      expect(projectsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: 'git@github.com:org/repo.git',
          tools: ['SAST', 'Port Scanner'],
        }),
      );
    });

    it('throws Forbidden when the requester is not assigned to the project', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      assignmentsRepository.find.mockResolvedValue([]);

      await expect(
        service.update(
          'project-1',
          { repo: 'git@github.com:org/repo.git' },
          analyst,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(projectsRepository.save).not.toHaveBeenCalled();
    });

    it('throws when the project does not exist', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(
          'missing',
          { repo: 'git@github.com:org/repo.git' },
          admin,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(projectsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAssignments', () => {
    it('returns the assigned users without their password hashes', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      const user = {
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: 'secret',
      } as User;
      assignmentsRepository.find.mockResolvedValue([
        {
          id: 'assignment-1',
          projectId: 'project-1',
          userId: 'user-1',
          user,
        } as ProjectAssignment,
      ]);

      const result = await service.findAssignments('project-1');

      expect(assignmentsRepository.find).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        relations: { user: true },
        order: { assignedAt: 'ASC' },
      });
      expect(usersService.toPublicUser).toHaveBeenCalledWith(user);
      expect(result[0]?.user).not.toHaveProperty('passwordHash');
    });

    it('throws when the project does not exist', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(service.findAssignments('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assignUser', () => {
    it('assigns an existing user to an existing project', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      usersService.findById.mockResolvedValue({ id: 'user-1' } as User);
      assignmentsRepository.findOne.mockResolvedValue(null);

      await service.assignUser('project-1', { userId: 'user-1' });

      expect(assignmentsRepository.create).toHaveBeenCalledWith({
        projectId: 'project-1',
        userId: 'user-1',
      });
      expect(assignmentsRepository.save).toHaveBeenCalled();
    });

    it('throws when the project does not exist', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assignUser('missing', { userId: 'user-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the user does not exist', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.assignUser('project-1', { userId: 'missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a duplicate assignment', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      usersService.findById.mockResolvedValue({ id: 'user-1' } as User);
      assignmentsRepository.findOne.mockResolvedValue({
        id: 'assignment-1',
      } as ProjectAssignment);

      await expect(
        service.assignUser('project-1', { userId: 'user-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(assignmentsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('unassignUser', () => {
    it('removes an existing assignment', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      assignmentsRepository.delete.mockResolvedValue({ affected: 1 });

      await service.unassignUser('project-1', 'user-1');

      expect(assignmentsRepository.delete).toHaveBeenCalledWith({
        projectId: 'project-1',
        userId: 'user-1',
      });
    });

    it('throws when the assignment does not exist', async () => {
      projectsRepository.findOne.mockResolvedValue({
        id: 'project-1',
      } as Project);
      assignmentsRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.unassignUser('project-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getAccessibleProjectIds', () => {
    it('returns null for an administrator, meaning unrestricted access', async () => {
      const result = await service.getAccessibleProjectIds(admin);

      expect(result).toBeNull();
      expect(assignmentsRepository.find).not.toHaveBeenCalled();
    });

    it('returns the assigned project ids for a non-administrator', async () => {
      assignmentsRepository.find.mockResolvedValue([
        { projectId: 'project-1' } as ProjectAssignment,
        { projectId: 'project-2' } as ProjectAssignment,
      ]);

      const result = await service.getAccessibleProjectIds(analyst);

      expect(assignmentsRepository.find).toHaveBeenCalledWith({
        where: { userId: analyst.id },
      });
      expect(result).toEqual(['project-1', 'project-2']);
    });
  });
});
