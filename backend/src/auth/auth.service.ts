import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/auth.dto';
import {
  JwtPayload,
  AuthResponse,
  JwtTokenType,
} from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.jwtSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(
        user.id,
        user.email,
        user.role,
      );

      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateTokens(userId: string, email: string, role: UserRole) {
    const accessToken = this.generateAccessToken(userId, email, role);
    const refreshToken = this.signToken(userId, email, role, 'refresh', {
      expiresIn: this.refreshTokenExpiry,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private generateAccessToken(
    userId: string,
    email: string,
    role: UserRole,
  ): string {
    return this.signToken(userId, email, role, 'access', {
      expiresIn: this.accessTokenExpiry,
    });
  }

  async validateUser(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  private signToken(
    userId: string,
    email: string,
    role: UserRole,
    type: JwtTokenType,
    options: { expiresIn: StringValue | number },
  ): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
      type,
    };

    return this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: options.expiresIn,
    });
  }

  private get jwtSecret(): string {
    return (
      this.configService.get<string>('JWT_SECRET') || 'development-only-secret'
    );
  }

  private get accessTokenExpiry(): StringValue {
    return (this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY') ||
      '15m') as StringValue;
  }

  private get refreshTokenExpiry(): StringValue {
    return (this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRY') ||
      '7d') as StringValue;
  }
}
