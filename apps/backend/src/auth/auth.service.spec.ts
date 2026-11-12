// apps/backend/src/auth/auth.service.spec.ts
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class MockJwtService {},
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

describe('Auth module (AuthService, AuthController, RolesGuard, Strategies)', (): void => {
  let authService: AuthService;
  let authController: AuthController;
  let usersService: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
    toPublicUser: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
  };

  const publicUser: Omit<User, 'passwordHash'> = {
    id: 'u1',
    email: 'analyst@code-sentinel.local',
    name: 'Analyst',
    role: UserRole.ANALYST,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  beforeEach((): void => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      toPublicUser: jest.fn((user: User): Omit<User, 'passwordHash'> => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      })),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
    };

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
    authController = new AuthController(authService);
  });

  describe('AuthService', (): void => {
    it('register debe hashear password, crear usuario y emitir token', async (): Promise<void> => {
      usersService.create.mockResolvedValue({
        ...publicUser,
        passwordHash: 'hash',
      });
      const response = await authService.register({
        email: publicUser.email,
        name: publicUser.name,
        password: 'Password1!',
      });
      expect(response.accessToken).toBe('signed-jwt-token');
      expect(response.user).toEqual(publicUser);
    });

    it('validateUser debe retornar usuario público si el password coincide o null si falla', async (): Promise<void> => {
      const passwordHash = await bcrypt.hash('Secret123!', 4);
      usersService.findByEmail.mockResolvedValue({
        ...publicUser,
        passwordHash,
      });

      const valid = await authService.validateUser(
        publicUser.email,
        'Secret123!',
      );
      expect(valid).toEqual(publicUser);

      const invalidPw = await authService.validateUser(
        publicUser.email,
        'WrongPassword',
      );
      expect(invalidPw).toBeNull();

      usersService.findByEmail.mockResolvedValueOnce(null);
      const missingUser = await authService.validateUser(
        'none@code-sentinel.local',
        'Secret123!',
      );
      expect(missingUser).toBeNull();
    });

    it('getAuthenticatedUser debe retornar el usuario o lanzar UnauthorizedException', async (): Promise<void> => {
      usersService.findById.mockResolvedValueOnce({
        ...publicUser,
        passwordHash: 'hash',
      });
      expect(await authService.getAuthenticatedUser('u1')).toEqual(publicUser);

      usersService.findById.mockResolvedValueOnce(null);
      await expect(authService.getAuthenticatedUser('missing')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('AuthController', (): void => {
    it('login y me deben retornar token y perfil del usuario autenticado', async (): Promise<void> => {
      const req = { user: publicUser } as AuthenticatedRequest;
      const dto = new LoginDto();
      dto.email = publicUser.email;
      dto.password = 'Password1!';
      const guard = new LocalAuthGuard();
      expect(guard.canActivate({} as ExecutionContext)).toBe(true);
      const loginResp = await authController.login(dto, req);
      expect(loginResp.accessToken).toBe('signed-jwt-token');
      expect(authController.me(req)).toEqual(publicUser);
    });
  });

  describe('RolesGuard', (): void => {
    it('debe permitir acceso cuando no hay roles requeridos o cuando el rol coincide', (): void => {
      const reflector = {
        getAllAndOverride: jest.fn(),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      const createContext = (role?: UserRole): ExecutionContext =>
        ({
          getHandler: () => ({}),
          getClass: () => ({}),
          switchToHttp: () => ({
            getRequest: () => ({ user: role ? { role } : undefined }),
          }),
        }) as unknown as ExecutionContext;

      (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(undefined);
      expect(guard.canActivate(createContext(UserRole.ANALYST))).toBe(true);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce([
        UserRole.ADMIN,
      ]);
      expect(guard.canActivate(createContext(UserRole.ADMIN))).toBe(true);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce([
        UserRole.ADMIN,
      ]);
      expect(() => guard.canActivate(createContext(UserRole.ANALYST))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('JwtStrategy & LocalStrategy', (): void => {
    it('JwtStrategy debe validar el payload o lanzar UnauthorizedException', async (): Promise<void> => {
      const configService = {
        get: jest.fn().mockReturnValue('test-secret'),
      } as unknown as ConfigService;
      const strategy = new JwtStrategy(configService, authService);

      usersService.findById.mockResolvedValueOnce({
        ...publicUser,
        passwordHash: 'hash',
      });
      expect(await strategy.validate({ sub: 'u1' })).toEqual(publicUser);

      usersService.findById.mockResolvedValueOnce(null);
      await expect(strategy.validate({ sub: 'missing' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('LocalStrategy debe retornar el usuario validado o lanzar UnauthorizedException', async (): Promise<void> => {
      const strategy = new LocalStrategy(authService);
      jest
        .spyOn(authService, 'validateUser')
        .mockResolvedValueOnce(publicUser)
        .mockResolvedValueOnce(null);

      expect(await strategy.validate(publicUser.email, 'Secret123!')).toEqual(
        publicUser,
      );
      await expect(
        strategy.validate(publicUser.email, 'Wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
