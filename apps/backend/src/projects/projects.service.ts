// apps/backend/src/projects/projects.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProjectDto } from './dto/create-project.dto';
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
}
