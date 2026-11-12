import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, AuthTokenResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(
    @Body() _loginDto: LoginDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthTokenResponse> {
    return this.authService.login(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest): Omit<User, 'passwordHash'> {
    return request.user;
  }
}
