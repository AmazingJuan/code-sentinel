// apps/backend/src/projects/projects.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(): Promise<Project[]> {
    return this.projectsService.findAll();
  }

  @Post()
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.create(createProjectDto, request.user.id);
  }
}
