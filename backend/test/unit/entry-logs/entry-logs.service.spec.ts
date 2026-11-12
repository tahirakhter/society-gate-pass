import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth.interface';
import { EntryLogsService } from '../../../src/entry-logs/entry-logs.service';
import type { PrismaService } from '../../../src/prisma/prisma.service';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  fullName: 'Admin',
  role: UserRole.ADMIN,
  isActive: true,
};

function createService() {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { entryLog: { findMany } };
  const service = new EntryLogsService(prisma as unknown as PrismaService);
  return { service, findMany };
}

describe('EntryLogsService date filter', () => {
  it('uses Pakistan-time day boundaries regardless of server timezone', async () => {
    const { service, findMany } = createService();

    await service.findAll(admin, { date: '2026-11-12' });

    const [{ where }] = findMany.mock.calls[0] as [
      { where: { scannedAt: { gte: Date; lt: Date } } },
    ];
    // 2026-11-12 00:00 PKT is 2026-11-11 19:00 UTC.
    expect(where.scannedAt.gte.toISOString()).toBe('2026-11-11T19:00:00.000Z');
    expect(where.scannedAt.lt.toISOString()).toBe('2026-11-12T19:00:00.000Z');
  });

  it('rejects a date that is not YYYY-MM-DD', async () => {
    const { service, findMany } = createService();

    await expect(
      service.findAll(admin, { date: 'not-a-date' }),
    ).rejects.toThrow(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not filter by date when none is given', async () => {
    const { service, findMany } = createService();

    await service.findAll(admin, {});

    const [{ where }] = findMany.mock.calls[0] as [{ where: object }];
    expect(where).not.toHaveProperty('scannedAt');
  });
});
