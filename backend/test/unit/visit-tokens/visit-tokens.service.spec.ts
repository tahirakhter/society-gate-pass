import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScanStatus } from '@prisma/client';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { VisitTokensService } from '../../../src/visit-tokens/visit-tokens.service';

type FakeToken = {
  id: string;
  tokenCode: string;
  visitorId: string;
  houseId: string;
  carNumber: string;
  expiresAt: Date;
  isUsed: boolean;
  isActive: boolean;
  revokedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  visitor: { id: string; cnic: string; fullName: string; createdAt: Date };
  house: {
    id: string;
    houseNumber: string;
    ownerId: string;
    block: string | null;
    createdAt: Date;
    owner: { id: string; fullName: string; email: string };
  };
};

const HOUR = 60 * 60 * 1000;

function createToken(overrides: Partial<FakeToken> = {}): FakeToken {
  const now = new Date();
  return {
    id: 'token-1',
    tokenCode: 'SGP-abc',
    visitorId: 'visitor-1',
    houseId: 'house-1',
    carNumber: 'LEA-1234',
    expiresAt: new Date(now.getTime() + HOUR),
    isUsed: false,
    isActive: true,
    revokedAt: null,
    createdBy: 'owner-1',
    createdAt: now,
    updatedAt: now,
    visitor: {
      id: 'visitor-1',
      cnic: '12345-1234567-1',
      fullName: 'Ali Khan',
      createdAt: now,
    },
    house: {
      id: 'house-1',
      houseNumber: '12',
      ownerId: 'owner-1',
      block: 'A',
      createdAt: now,
      owner: { id: 'owner-1', fullName: 'Owner', email: 'owner@example.com' },
    },
    ...overrides,
  };
}

/**
 * In-memory stand-in for the visitToken/entryLog tables. Reads return
 * snapshots, and updateMany only applies when every where condition holds,
 * so it behaves like the conditional UPDATE the service relies on.
 */
function createFakePrisma(token: FakeToken) {
  const entryLogs: Array<{
    scanStatus: ScanStatus;
    failureReason?: string;
  }> = [];

  const prisma = {
    visitToken: {
      findUnique: jest.fn(() => Promise.resolve({ ...token })),
      findUniqueOrThrow: jest.fn(() => Promise.resolve({ ...token })),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: {
            isUsed: boolean;
            isActive: boolean;
            expiresAt: { gt: Date };
          };
          data: { isUsed: boolean };
        }) => {
          const matches =
            token.isUsed === where.isUsed &&
            token.isActive === where.isActive &&
            token.expiresAt > where.expiresAt.gt;
          if (matches) {
            Object.assign(token, data);
          }
          return Promise.resolve({ count: matches ? 1 : 0 });
        },
      ),
      update: jest.fn(({ data }: { data: Partial<FakeToken> }) => {
        Object.assign(token, data);
        return Promise.resolve({ ...token });
      }),
    },
    entryLog: {
      create: jest.fn(
        ({
          data,
        }: {
          data: { scanStatus: ScanStatus; failureReason?: string };
        }) => {
          entryLogs.push(data);
          return Promise.resolve(data);
        },
      ),
    },
  };

  return { prisma, entryLogs };
}

function createService(token: FakeToken) {
  const { prisma, entryLogs } = createFakePrisma(token);
  const service = new VisitTokensService(
    prisma as unknown as PrismaService,
    new ConfigService(),
  );
  return { service, prisma, entryLogs };
}

describe('VisitTokensService.validate', () => {
  it('approves a valid unused pass and marks it used', async () => {
    const token = createToken();
    const { service, entryLogs } = createService(token);

    const result = await service.validate('guard-1', { tokenCode: 'SGP-abc' });

    expect(result.approved).toBe(true);
    expect(token.isUsed).toBe(true);
    expect(entryLogs).toEqual([
      expect.objectContaining({ scanStatus: ScanStatus.SUCCESS }),
    ]);
  });

  it('approves only one of two simultaneous scans of the same pass', async () => {
    const token = createToken();
    const { service, entryLogs } = createService(token);

    // Both calls read the token before either one claims it, which is the
    // interleaving that let a single-use pass be approved twice.
    const results = await Promise.all([
      service.validate('guard-1', { tokenCode: 'SGP-abc' }),
      service.validate('guard-2', { tokenCode: 'SGP-abc' }),
    ]);

    expect(results.filter((result) => result.approved)).toHaveLength(1);
    const rejected = results.find((result) => !result.approved);
    expect(rejected?.failureReason).toBe('Token has already been used');
    expect(entryLogs.map((log) => log.scanStatus).sort()).toEqual(
      [ScanStatus.FAILED, ScanStatus.SUCCESS].sort(),
    );
  });

  it('rejects a pass that was already used', async () => {
    const token = createToken({ isUsed: true });
    const { service, prisma } = createService(token);

    const result = await service.validate('guard-1', { tokenCode: 'SGP-abc' });

    expect(result.approved).toBe(false);
    expect(result.failureReason).toBe('Token has already been used');
    expect(prisma.visitToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a pass revoked between the read and the claim', async () => {
    const token = createToken();
    const { service, prisma } = createService(token);
    prisma.visitToken.findUnique.mockImplementationOnce(() => {
      const snapshot = { ...token };
      token.isActive = false;
      return Promise.resolve(snapshot);
    });

    const result = await service.validate('guard-1', { tokenCode: 'SGP-abc' });

    expect(result.approved).toBe(false);
    expect(result.failureReason).toBe('Token has been deactivated');
    expect(token.isUsed).toBe(false);
  });
});

describe('VisitTokensService deactivation', () => {
  it('revokes an active pass for its owner', async () => {
    const token = createToken();
    const { service } = createService(token);

    const result = await service.deactivate('owner-1', token.id);

    expect(result.isActive).toBe(false);
    expect(result.revokedAt).toBeInstanceOf(Date);
  });

  it('returns 400 when the pass is already revoked', async () => {
    const token = createToken({ isActive: false });
    const { service, prisma } = createService(token);

    await expect(service.deactivateAsAdmin(token.id)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.visitToken.update).not.toHaveBeenCalled();
  });
});
