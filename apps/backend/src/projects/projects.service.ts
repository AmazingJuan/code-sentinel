// apps/backend/src/projects/projects.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AssignProjectDto } from './dto/assign-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectAssignment } from './project-assignment.entity';
import { Project } from './project.entity';
import { RequestingUser } from '../types/requesting-user.type';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

export type PublicProjectAssignment = Omit<ProjectAssignment, 'user'> & {
  user: Omit<User, 'passwordHash'>;
};

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
      throw new ConflictException(
        'A project with this name is already registered',
      );
    }

    const project = await this.projectsRepository.save(
      this.projectsRepository.create({
        name,
        repo,
        userId,
      }),
    );

    // The registrant is automatically assigned so the project they just
    // registered is immediately available to them for configuration and
    // scanning, without waiting on a separate administrator action.
    await this.assignmentsRepository.save(
      this.assignmentsRepository.create({ projectId: project.id, userId }),
    );

    return project;
  }

  findByName(name: string): Promise<Project | null> {
    return this.projectsRepository.findOne({ where: { name } });
  }

  async findAll(requester: RequestingUser): Promise<Project[]> {
    const accessibleProjectIds = await this.getAccessibleProjectIds(requester);
    if (accessibleProjectIds === null) {
      return this.projectsRepository.find({ order: { createdAt: 'DESC' } });
    }
    if (accessibleProjectIds.length === 0) {
      return [];
    }
    return this.projectsRepository.find({
      where: { id: In(accessibleProjectIds) },
      order: { createdAt: 'DESC' },
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
    return assignments.map((assignment) => ({
      ...assignment,
      user: this.usersService.toPublicUser(assignment.user),
    }));
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
      throw new ConflictException(
        'This user is already assigned to the project',
      );
    }

    return this.assignmentsRepository.save(
      this.assignmentsRepository.create({
        projectId,
        userId: assignProjectDto.userId,
      }),
    );
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
   * Returns the ids of the projects the requester is authorized to access:
   * `null` means no restriction applies (administrators can access every
   * project), while an array (possibly empty) lists the assigned project ids
   * for any other role.
   */
  async getAccessibleProjectIds(
    requester: RequestingUser,
  ): Promise<string[] | null> {
    if (requester.role === UserRole.ADMIN) {
      return null;
    }
    const assignments = await this.assignmentsRepository.find({
      where: { userId: requester.id },
    });
    return assignments.map((assignment) => assignment.projectId);
  }

  private async assertAccess(
    projectId: string,
    requester: RequestingUser,
  ): Promise<void> {
    const accessibleProjectIds = await this.getAccessibleProjectIds(requester);
    if (accessibleProjectIds === null) {
      return;
    }
    if (!accessibleProjectIds.includes(projectId)) {
      throw new ForbiddenException('You are not assigned to this project');
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
