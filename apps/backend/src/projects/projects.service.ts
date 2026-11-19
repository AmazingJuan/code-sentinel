import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/postgres-errors';
import { RequestingUser } from '../types/requesting-user.type';
import { PublicUser, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AssignProjectDto } from './dto/assign-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectAssignment } from './project-assignment.entity';
import { Project } from './project.entity';

export type PublicProjectAssignment = Omit<ProjectAssignment, 'user'> & {
  user: PublicUser;
};

/** Id and name only: what an administrator needs to manage assignments. */
export type ProjectDirectoryEntry = Pick<Project, 'id' | 'name'>;

const PROJECT_NAME_TAKEN_MESSAGE =
  'A project with this name is already registered';
const ALREADY_ASSIGNED_MESSAGE = 'This user is already assigned to the project';
const NOT_ASSIGNED_MESSAGE = 'You are not assigned to this project';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
    private readonly usersService: UsersService,
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    userId: string,
  ): Promise<Project> {
    const name = createProjectDto.name.trim();
    const repo = createProjectDto.repo.trim();

    const existingProject = await this.findByName(name);
    if (existingProject) {
      throw new ConflictException(PROJECT_NAME_TAKEN_MESSAGE);
    }

    try {
      return await this.projectsRepository.manager.transaction(
        async (manager: EntityManager): Promise<Project> => {
          const projects = manager.getRepository(Project);
          const assignments = manager.getRepository(ProjectAssignment);
          const project = await projects.save(
            projects.create({ name, repo, userId }),
          );
          // The registrant is assigned right away so the project is usable
          // without waiting for an administrator.
          await assignments.save(
            assignments.create({ projectId: project.id, userId }),
          );
          return project;
        },
      );
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(PROJECT_NAME_TAKEN_MESSAGE);
      }
      throw error;
    }
  }

  findByName(name: string): Promise<Project | null> {
    return this.projectsRepository.findOne({ where: { name } });
  }

  async findAll(requester: RequestingUser): Promise<Project[]> {
    const accessibleProjectIds = await this.getAccessibleProjectIds(requester);
    if (accessibleProjectIds.length === 0) {
      return [];
    }
    return this.projectsRepository.find({
      where: { id: In(accessibleProjectIds) },
      order: { createdAt: 'DESC' },
    });
  }

  findDirectory(): Promise<ProjectDirectoryEntry[]> {
    return this.projectsRepository.find({
      select: { id: true, name: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string, requester: RequestingUser): Promise<Project> {
    const project = await this.findByIdUnchecked(id);
    await this.assertAccess(id, requester);
    return project;
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    requester: RequestingUser,
  ): Promise<Project> {
    const project = await this.findByIdUnchecked(id);
    await this.assertAccess(id, requester);

    if (updateProjectDto.repo !== undefined) {
      project.repo = updateProjectDto.repo.trim();
    }
    if (updateProjectDto.tools !== undefined) {
      project.tools = updateProjectDto.tools;
    }

    return this.projectsRepository.save(project);
  }

  async findAssignments(projectId: string): Promise<PublicProjectAssignment[]> {
    await this.findByIdUnchecked(projectId);
    const assignments = await this.assignmentsRepository.find({
      where: { projectId },
      relations: { user: true },
      order: { assignedAt: 'ASC' },
    });
    return assignments.map(
      (assignment: ProjectAssignment): PublicProjectAssignment => ({
        ...assignment,
        user: this.usersService.toPublicUser(assignment.user),
      }),
    );
  }

  async assignUser(
    projectId: string,
    assignProjectDto: AssignProjectDto,
  ): Promise<ProjectAssignment> {
    await this.findByIdUnchecked(projectId);

    const user = await this.usersService.findById(assignProjectDto.userId);
    if (!user) {
      throw new NotFoundException(`User ${assignProjectDto.userId} not found`);
    }

    const existingAssignment = await this.assignmentsRepository.findOne({
      where: { projectId, userId: assignProjectDto.userId },
    });
    if (existingAssignment) {
      throw new ConflictException(ALREADY_ASSIGNED_MESSAGE);
    }

    try {
      return await this.assignmentsRepository.save(
        this.assignmentsRepository.create({
          projectId,
          userId: assignProjectDto.userId,
        }),
      );
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(ALREADY_ASSIGNED_MESSAGE);
      }
      throw error;
    }
  }

  async unassignUser(projectId: string, userId: string): Promise<void> {
    await this.findByIdUnchecked(projectId);
    const result = await this.assignmentsRepository.delete({
      projectId,
      userId,
    });
    if (!result.affected) {
      throw new NotFoundException('This user is not assigned to the project');
    }
  }

  /**
   * Ids of the projects whose security content the requester may access.
   * Administrators always get an empty list (RF-032): they manage identities,
   * never projects, scans, findings or reports.
   */
  async getAccessibleProjectIds(requester: RequestingUser): Promise<string[]> {
    if (requester.role === UserRole.ADMIN) {
      return [];
    }
    const assignments = await this.assignmentsRepository.find({
      where: { userId: requester.id },
    });
    return assignments.map(
      (assignment: ProjectAssignment): string => assignment.projectId,
    );
  }

  private async assertAccess(
    projectId: string,
    requester: RequestingUser,
  ): Promise<void> {
    const accessibleProjectIds = await this.getAccessibleProjectIds(requester);
    if (!accessibleProjectIds.includes(projectId)) {
      throw new ForbiddenException(NOT_ASSIGNED_MESSAGE);
    }
  }

  private async findByIdUnchecked(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }
}
