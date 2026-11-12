import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { EntryLogQueryDto } from './dto/entry-log.dto';

@Injectable()
export class EntryLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser, query: EntryLogQueryDto) {
    const where = {
      ...this.buildDateFilter(query.date),
      ...this.buildRoleFilter(user, query.houseId),
    };

    const logs = await this.prisma.entryLog.findMany({
      where,
      include: {
        scanner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        token: {
          include: {
            visitor: true,
            house: {
              include: {
                owner: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        scannedAt: 'desc',
      },
      take: 100,
    });

    return logs.map((log) => ({
      ...log,
      token: log.token
        ? {
            ...log.token,
            qrPayload: log.token.tokenCode,
            status: this.getTokenStatus(log.token),
          }
        : null,
    }));
  }

  private buildRoleFilter(user: AuthenticatedUser, houseId?: string) {
    if (user.role === UserRole.OWNER) {
      return {
        token: {
          house: {
            ownerId: user.id,
            ...(houseId ? { id: houseId } : {}),
          },
        },
      };
    }

    if (houseId) {
      return {
        token: {
          houseId,
        },
      };
    }

    return {};
  }

  private buildDateFilter(date?: string) {
    if (!date) {
      return {};
    }

    // Interpret the calendar day in Pakistan time (UTC+05:00, no DST) so the
    // boundaries don't depend on the server's timezone and match the AI
    // analytics day boundaries.
    const day = date.slice(0, 10);
    const start = new Date(`${day}T00:00:00.000+05:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(start.getTime())) {
      throw new BadRequestException('Date filter must be a valid date');
    }

    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return {
      scannedAt: {
        gte: start,
        lt: end,
      },
    };
  }

  private getTokenStatus(visitToken: {
    isActive: boolean;
    isUsed: boolean;
    expiresAt: Date;
  }): 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED' {
    if (!visitToken.isActive) {
      return 'REVOKED';
    }

    if (visitToken.isUsed) {
      return 'USED';
    }

    if (visitToken.expiresAt < new Date()) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }
}
