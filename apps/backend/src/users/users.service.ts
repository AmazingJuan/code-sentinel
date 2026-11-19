import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword } from '../common/password';
import { isUniqueViolation } from '../common/postgres-errors';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUser, User, UserRole } from './entities/user.entity';

export interface DefaultUserDefinition {
  id: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

/**
 * Demo accounts provisioned on startup so a fresh environment is usable.
 * Their passwords are public: change them on any shared deployment.
 */
export const DEFAULT_USERS: readonly DefaultUserDefinition[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'demo@code-sentinel.local',
    name: 'Demo User',
    password: 'Demo1234!',
    role: UserRole.ANALYST,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'admin@code-sentinel.local',
    name: 'Admin User',
    password: 'Admin1234!',
    role: UserRole.ADMIN,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'analyst@code-sentinel.local',
    name: 'Analyst User',
    password: 'Analyst1234!',
    role: UserRole.ANALYST,
  },
];

const EMAIL_TAKEN_MESSAGE = 'Email already registered';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const created = await this.ensureDefaultUsers();
    if (created > 0) {
      this.logger.warn(
        `Provisioned ${created} default account(s) with well-known passwords; change them on any shared deployment.`,
      );
    }
  }

  /** Creates any missing default account. Returns how many were created. */
  async ensureDefaultUsers(): Promise<number> {
    let created = 0;
    for (const def of DEFAULT_USERS) {
      const existing = await this.findByEmail(def.email);
      if (existing) continue;
      try {
        await this.usersRepository.save(
          this.usersRepository.create({
            id: def.id,
            email: def.email.toLowerCase(),
            name: def.name,
            passwordHash: await hashPassword(def.password),
            role: def.role,
          }),
        );
        created += 1;
      } catch (error: unknown) {
        // Another replica may have created it concurrently during startup.
        if (!isUniqueViolation(error)) throw error;
      }
    }
    return created;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException(EMAIL_TAKEN_MESSAGE);
    }

    try {
      return await this.usersRepository.save(
        this.usersRepository.create({
          email: createUserDto.email.toLowerCase(),
          name: createUserDto.name,
          passwordHash: await hashPassword(createUserDto.password),
          role: createUserDto.role ?? UserRole.ANALYST,
        }),
      );
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
    return users.map((user: User): PublicUser => this.toPublicUser(user));
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (
      updateUserDto.email &&
      updateUserDto.email.toLowerCase() !== user.email
    ) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      user.email = updateUserDto.email.toLowerCase();
    }
    if (updateUserDto.name !== undefined) user.name = updateUserDto.name;
    if (updateUserDto.role !== undefined) user.role = updateUserDto.role;
    if (updateUserDto.password) {
      user.passwordHash = await hashPassword(updateUserDto.password);
    }

    try {
      return this.toPublicUser(await this.usersRepository.save(user));
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (!result.affected) throw new NotFoundException('User not found');
  }

  toPublicUser(user: User): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }
}
