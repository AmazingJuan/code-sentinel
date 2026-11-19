import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { UserRole } from '../users/entities/user.entity';
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

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // Must be declared before ':id' so "directory" is not parsed as an id.
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
    @Param('id', ParseUUIDPipe) id: string,
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Project> {
    return this.projectsService.update(id, updateProjectDto, request.user);
  }

  @Get(':id/assignments')
  @Roles(UserRole.ADMIN)
  findAssignments(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicProjectAssignment[]> {
    return this.projectsService.findAssignments(id);
  }

  @Post(':id/assignments')
  @Roles(UserRole.ADMIN)
  assignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignProjectDto: AssignProjectDto,
  ): Promise<ProjectAssignment> {
    return this.projectsService.assignUser(id, assignProjectDto);
  }

  @Delete(':id/assignments/:userId')
  @Roles(UserRole.ADMIN)
  unassignUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.projectsService.unassignUser(id, userId);
  }
}
