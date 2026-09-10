// apps/backend/src/projects/projects.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { AssignProjectDto } from './dto/assign-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectAssignment } from './project-assignment.entity';
import { Project } from './project.entity';
import { ProjectsService, PublicProjectAssignment } from './projects.service';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest): Promise<Project[]> {
    return this.projectsService.findAll(request.user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.findById(id, request.user);
  }

  @Post()
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.create(createProjectDto, request.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.update(id, updateProjectDto, request.user);
  }

  @Get(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAssignments(@Param('id') id: string): Promise<PublicProjectAssignment[]> {
    return this.projectsService.findAssignments(id);
  }

  @Post(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  assignUser(
    @Param('id') id: string,
    @Body() assignProjectDto: AssignProjectDto,
  ): Promise<ProjectAssignment> {
    return this.projectsService.assignUser(id, assignProjectDto);
  }

  @Delete(':id/assignments/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  unassignUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.projectsService.unassignUser(id, userId);
  }
}
