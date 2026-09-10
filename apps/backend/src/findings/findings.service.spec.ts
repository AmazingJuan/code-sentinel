import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

// `@nestjs/typeorm`'s published build is ESM-only and cannot be parsed by the
// CommonJS Jest transform configured for this project. `FindingsService` only
// uses `InjectRepository` as a parameter decorator, so a no-op stub is safe here.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { Finding } from './finding.entity';
import { FindingsService } from './findings.service';
import { ProjectsService } from '../projects/projects.service';
import { ScansService } from '../scans/scans.service';
import { RequestingUser } from '../types/requesting-user.type';
import { UserRole } from '../users/entities/user.entity';

interface MockFindingRepository {
  find: jest.Mock<Promise<Finding[]>, [unknown]>;
  findOne: jest.Mock<Promise<Finding | null>, [unknown]>;
}

function createMockFindingRepository(): MockFindingRepository {
  return {
    find: jest.fn<Promise<Finding[]>, [unknown]>(),
    findOne: jest.fn<Promise<Finding | null>, [unknown]>(),
  };
}

interface MockProjectsService {
  getAccessibleProjectIds: jest.Mock<
    Promise<string[] | null>,
    [RequestingUser]
  >;
}

interface MockScansService {
  findProjectIdForScan: jest.Mock<Promise<string | null>, [string]>;
  findScanIdsForProjects: jest.Mock<Promise<string[]>, [string[]]>;
}

const admin: RequestingUser = { id: 'admin-1', role: UserRole.ADMIN };
const analyst: RequestingUser = { id: 'analyst-1', role: UserRole.ANALYST };

describe('FindingsService', () => {
  let service: FindingsService;
  let findingRepository: MockFindingRepository;
  let projectsService: MockProjectsService;
  let scansService: MockScansService;

  beforeEach(() => {
    findingRepository = createMockFindingRepository();
    projectsService = {
      getAccessibleProjectIds: jest.fn<
        Promise<string[] | null>,
        [RequestingUser]
      >(),
    };
    scansService = {
      findProjectIdForScan: jest.fn<Promise<string | null>, [string]>(),
      findScanIdsForProjects: jest.fn<Promise<string[]>, [string[]]>(),
    };
    service = new FindingsService(
      findingRepository as unknown as Repository<Finding>,
      projectsService as unknown as ProjectsService,
      scansService as unknown as ScansService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('does not restrict the query for an administrator', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue(null);
      findingRepository.find.mockResolvedValue([]);

      await service.findAll({}, admin);

      expect(scansService.findScanIdsForProjects).not.toHaveBeenCalled();
      expect(findingRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('returns an empty list without querying when a non-administrator has no assignments', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue([]);

      const result = await service.findAll({}, analyst);

      expect(findingRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('restricts the query to scans of the assigned projects for a non-administrator', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue(['project-1']);
      scansService.findScanIdsForProjects.mockResolvedValue([
        'scan-1',
        'scan-2',
      ]);
      findingRepository.find.mockResolvedValue([]);

      await service.findAll({}, analyst);

      expect(scansService.findScanIdsForProjects).toHaveBeenCalledWith([
        'project-1',
      ]);
      const call = findingRepository.find.mock.calls[0]?.[0] as {
        where?: { scanId?: unknown };
      };
      expect(call.where?.scanId).toBeDefined();
    });

    it('returns an empty list when filtering by a scan outside the accessible projects', async () => {
      projectsService.getAccessibleProjectIds.mockResolvedValue(['project-1']);
      scansService.findProjectIdForScan.mockResolvedValue('project-2');

      const result = await service.findAll({ scanId: 'scan-1' }, analyst);

      expect(findingRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns the finding for an administrator', async () => {
      const finding = { id: 'finding-1', scanId: 'scan-1' } as Finding;
      findingRepository.findOne.mockResolvedValue(finding);
      projectsService.getAccessibleProjectIds.mockResolvedValue(null);

      const result = await service.findOne('finding-1', admin);

      expect(result).toBe(finding);
    });

    it('returns the finding for a requester assigned to its project', async () => {
      const finding = { id: 'finding-1', scanId: 'scan-1' } as Finding;
      findingRepository.findOne.mockResolvedValue(finding);
      projectsService.getAccessibleProjectIds.mockResolvedValue(['project-1']);
      scansService.findProjectIdForScan.mockResolvedValue('project-1');

      const result = await service.findOne('finding-1', analyst);

      expect(result).toBe(finding);
    });

    it('throws Forbidden for a requester not assigned to the finding project', async () => {
      const finding = { id: 'finding-1', scanId: 'scan-1' } as Finding;
      findingRepository.findOne.mockResolvedValue(finding);
      projectsService.getAccessibleProjectIds.mockResolvedValue(['project-2']);
      scansService.findProjectIdForScan.mockResolvedValue('project-1');

      await expect(
        service.findOne('finding-1', analyst),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the finding does not exist', async () => {
      findingRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
