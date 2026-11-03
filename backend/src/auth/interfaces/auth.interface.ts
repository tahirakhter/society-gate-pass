import { UserRole } from '@prisma/client';
import { Request } from 'express';

export type JwtTokenType = 'access' | 'refresh';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface JwtPayload {
  sub: string; // user_id
  email: string;
  role: UserRole;
  type: JwtTokenType;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
}
