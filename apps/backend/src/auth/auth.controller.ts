import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import type { PublicUser } from '../users/entities/user.entity';
import { AuthService, AuthTokenResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // LoginDto is declared so the global ValidationPipe rejects malformed
  // bodies; the credentials themselves are checked by LocalAuthGuard.
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
  me(@Req() request: AuthenticatedRequest): PublicUser {
    return request.user;
  }
}
