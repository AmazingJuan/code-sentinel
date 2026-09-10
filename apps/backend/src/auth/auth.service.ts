import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(createUserDto.password, 12);
    const user = await this.usersService.create(createUserDto, passwordHash);
    return this.issueToken(this.usersService.toPublicUser(user));
  }

  async validateUser(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return null;
    }

    return this.usersService.toPublicUser(user);
  }

  async login(user: Omit<User, 'passwordHash'>) {
    return this.issueToken(user);
  }

  private async issueToken(user: Omit<User, 'passwordHash'>) {
    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
  }

  async getAuthenticatedUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.usersService.toPublicUser(user);
  }
}
