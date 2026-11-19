import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { UserRole } from '../users/entities/user.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController', (): void => {
  let controller: ProjectsController;
  let projectsService: {
    findDirectory: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findAssignments: jest.Mock;
    assignUser: jest.Mock;
    unassignUser: jest.Mock;
  };

  const request: AuthenticatedRequest = {
    user: {
      id: 'u1',
      email: 'analyst@code-sentinel.local',
      name: 'Analyst',
      role: UserRole.ANALYST,
      createdAt: new Date(),
    },
  } as AuthenticatedRequest;

  beforeEach((): void => {
    projectsService = {
      findDirectory: jest
        .fn()
        .mockResolvedValue([{ id: 'p1', name: 'code-sentinel' }]),
      findAll: jest.fn().mockResolvedValue([{ id: 'p1' }]),
      findById: jest.fn().mockResolvedValue({ id: 'p1' }),
      create: jest.fn().mockResolvedValue({ id: 'p1', name: 'code-sentinel' }),
      update: jest.fn().mockResolvedValue({ id: 'p1', repo: 'new-repo' }),
      findAssignments: jest.fn().mockResolvedValue([]),
      assignUser: jest
        .fn()
        .mockResolvedValue({ id: 'a1', projectId: 'p1', userId: 'u1' }),
      unassignUser: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ProjectsController(
      projectsService as unknown as ProjectsService,
    );
  });

  it('delegates every method to ProjectsService', async (): Promise<void> => {
    expect(await controller.findDirectory()).toEqual([
      { id: 'p1', name: 'code-sentinel' },
    ]);
    expect(await controller.findAll(request)).toEqual([{ id: 'p1' }]);
    expect(await controller.findOne('p1', request)).toEqual({ id: 'p1' });
    expect(
      await controller.create(
        { name: 'code-sentinel', repo: 'repo-url' },
        request,
      ),
    ).toEqual({ id: 'p1', name: 'code-sentinel' });
    expect(
      await controller.update(
        'p1',
        { repo: 'new-repo', tools: ['SAST'] },
        request,
      ),
    ).toEqual({ id: 'p1', repo: 'new-repo' });
    expect(await controller.findAssignments('p1')).toEqual([]);
    expect(await controller.assignUser('p1', { userId: 'u1' })).toEqual({
      id: 'a1',
      projectId: 'p1',
      userId: 'u1',
    });
    await expect(controller.unassignUser('p1', 'u1')).resolves.toBeUndefined();
  });
});
