import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

// `@nestjs/typeorm`'s published build is ESM-only and cannot be parsed by the
// CommonJS Jest transform configured for this project. `ScansService` only
// uses `InjectRepository` as a parameter decorator, so a no-op stub is safe here.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { Scan } from './scan.entity';
import { ScansService } from './scans.service';
import { ProjectsService } from '../projects/projects.service';
import { RequestingUser } from '../types/requesting-user.type';
import { UserRole } from '../users/entities/user.entity';

interface MockScanRepository {
  find: jest.Mock<Promise<Scan[]>, [unknown]>;
  findOne: jest.Mock<Promise<Scan | null>, [unknown]>;
}

function createMockScanRepository(): MockScanRepository {
  return {
    find: jest.fn<Promise<Scan[]>, [unknown]>(),
    findOne: jest.fn<Promise<Scan | null>, [unknown]>(),
  };
}

interface MockProjectsService {
  getAccessibleProjectIds: jest.Mock<
    Promise<string[] | null>,
    [RequestingUser]
  >;
}

const admin: RequestingUser = { id: 'admin-1', role: UserRole.ADMIN };
const analyst: RequestingUser = { id: 'analyst-1', role: UserRole.ANALYST };

describe('ScansService', () => {
  let service: ScansService;
  let scanRepository: MockScanRepository;
  let projectsService: MockProjectsService;

  beforeEach(() => {
    scanRepository = createMockScanRepository();
    projectsService = {
      getAccessibleProjectIds: jest.fn<
        Promise<string[] | null>,
        [RequestingUser]
      >(),
    };
    service = new ScansService(
      scanRepository as unknown as Repository<Scan>,
      projectsService as unknown as ProjectsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('does not restrict the query for an administrator', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue(null);
      scanRepository.find.mockResolvedValue([]);

      await service.findAll({}, admin);

      expect(scanRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('returns an empty list without querying when a non-administrator has no assignments', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue([]);

      const result = await service.findAll({}, analyst);

      expect(scanRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('restricts the query to the assigned projects for a non-administrator', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue([
        'project-1',
        'project-2',
      ]);
      scanRepository.find.mockResolvedValue([]);

      await service.findAll({}, analyst);

      const call = scanRepository.find.mock.calls[0]?.[0] as {
        where?: { projectId?: unknown };
      };
      expect(call.where?.projectId).toBeDefined();
    });

    it('returns an empty list when filtering by a project the requester cannot access', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue(['project-1']);

      const result = await service.findAll({ projectId: 'project-2' }, analyst);

      expect(scanRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns the scan for an administrator', async () => {
      const scan = { id: 'scan-1', projectId: 'project-1' } as Scan;
      scanRepository.findOne.mockResolvedValue(scan);
      projectsService.getAccessibleProjectIds.mockResolvedValue(null);

      const result = await service.findOne('scan-1', admin);

      expect(result).toBe(scan);
    });

    it('returns the scan for a requester assigned to its project', async () => {
      const scan = { id: 'scan-1', projectId: 'project-1' } as Scan;
      scanRepository.findOne.mockResolvedValue(scan);
      projectsService.getAccessibleProjectIds.mockResolvedValue(['project-1']);

      const result = await service.findOne('scan-1', analyst);

      expect(result).toBe(scan);
    });

    it('throws Forbidden for a requester not assigned to the scan project', async () => {
      const scan = { id: 'scan-1', projectId: 'project-1' } as Scan;
      scanRepository.findOne.mockResolvedValue(scan);
      projectsService.getAccessibleProjectIds.mockResolvedValue(['project-2']);

      await expect(service.findOne('scan-1', analyst)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws when the scan does not exist', async () => {
      scanRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findProjectIdForScan', () => {
    it('returns the project id of an existing scan', async () => {
      scanRepository.findOne.mockResolvedValue({
        id: 'scan-1',
        projectId: 'project-1',
      } as Scan);

      const result = await service.findProjectIdForScan('scan-1');

      expect(result).toBe('project-1');
    });

    it('returns null when the scan does not exist', async () => {
      scanRepository.findOne.mockResolvedValue(null);

      const result = await service.findProjectIdForScan('missing');

      expect(result).toBeNull();
    });
  });
});
