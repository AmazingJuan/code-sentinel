import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword } from '../common/password';
import type { PublicUser } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

export interface AuthTokenResponse {
  accessToken: string;
  user: PublicUser;
}

interface JwtPayload {
  sub: string;
  email: string;
}

// bcrypt hash of a random throwaway value. Comparing against it when the
// email is unknown keeps login timing uniform and avoids user enumeration.
const TIMING_SAFE_DUMMY_HASH =
  '$2b$12$FyCUoyqAY9GEdiefGmji2.afIg26g.IsDbe2Asyv1UheDA7.xtdp6';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<PublicUser | null> {
    const user = await this.usersService.findByEmail(email);
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH,
    );
    if (!user || !passwordMatches) {
      return null;
    }
    return this.usersService.toPublicUser(user);
  }

  async login(user: PublicUser): Promise<AuthTokenResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
  }

  async getAuthenticatedUser(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.usersService.toPublicUser(user);
  }
}
