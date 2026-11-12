import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<Array<Omit<User, 'passwordHash'>>> {
    return this.usersService.findAll();
  }

  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const passwordHash = await bcrypt.hash(createUserDto.password, 12);
    return this.usersService.toPublicUser(
      await this.usersService.create(createUserDto, passwordHash),
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
