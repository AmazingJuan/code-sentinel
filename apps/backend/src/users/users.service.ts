import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto, passwordHash: string): Promise<User> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    return this.usersRepository.save(
      this.usersRepository.create({
        email: createUserDto.email.toLowerCase(),
        name: createUserDto.name,
        passwordHash,
        role: createUserDto.role ?? UserRole.ANALYST,
      }),
    );
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll() {
    const users = await this.usersRepository.find({ order: { createdAt: 'DESC' } });
    return users.map((user) => this.toPublicUser(user));
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (updateUserDto.email && updateUserDto.email.toLowerCase() !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) throw new ConflictException('Email already registered');
      user.email = updateUserDto.email.toLowerCase();
    }
    if (updateUserDto.name !== undefined) user.name = updateUserDto.name;
    if (updateUserDto.role !== undefined) user.role = updateUserDto.role;
    if (updateUserDto.password) user.passwordHash = await bcrypt.hash(updateUserDto.password, 12);

    return this.toPublicUser(await this.usersRepository.save(user));
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (!result.affected) throw new NotFoundException('User not found');
  }

  toPublicUser(user: User) {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }
}
