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
import {
  ProjectDirectoryEntry,
  ProjectsService,
  PublicProjectAssignment,
} from './projects.service';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // RF-035 + RF-032: the admin only sees id and name, to assign projects.
  // Declared before ':id' so Express does not read "directory" as an id.
  @Get('directory')
  @Roles(UserRole.ADMIN)
  findDirectory(): Promise<ProjectDirectoryEntry[]> {
    return this.projectsService.findDirectory();
  }

  @Get()
  @Roles(UserRole.ANALYST)
  findAll(@Req() request: AuthenticatedRequest): Promise<Project[]> {
    return this.projectsService.findAll(request.user);
  }

  @Get(':id')
  @Roles(UserRole.ANALYST)
  findOne(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.findById(id, request.user);
  }

  @Post()
  @Roles(UserRole.ANALYST)
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.create(createProjectDto, request.user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ANALYST)
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.update(id, updateProjectDto, request.user);
  }

  @Get(':id/assignments')
  @Roles(UserRole.ADMIN)
  findAssignments(@Param('id') id: string): Promise<PublicProjectAssignment[]> {
    return this.projectsService.findAssignments(id);
  }

  @Post(':id/assignments')
  @Roles(UserRole.ADMIN)
  assignUser(
    @Param('id') id: string,
    @Body() assignProjectDto: AssignProjectDto,
  ): Promise<ProjectAssignment> {
    return this.projectsService.assignUser(id, assignProjectDto);
  }

  @Delete(':id/assignments/:userId')
  @Roles(UserRole.ADMIN)
  unassignUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.projectsService.unassignUser(id, userId);
  }
}
