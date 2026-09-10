// apps/backend/src/projects/projects.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
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

    return this.projectsRepository.save(
      this.projectsRepository.create({
        name,
        repo,
        userId,
      }),
    );
  }

  findByName(name: string): Promise<Project | null> {
    return this.projectsRepository.findOne({ where: { name } });
  }

  findAll(): Promise<Project[]> {
    return this.projectsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findById(id);

    if (updateProjectDto.repo !== undefined) {
      project.repo = updateProjectDto.repo.trim();
    }
    if (updateProjectDto.tools !== undefined) {
      project.tools = updateProjectDto.tools;
    }

    return this.projectsRepository.save(project);
  }
}
