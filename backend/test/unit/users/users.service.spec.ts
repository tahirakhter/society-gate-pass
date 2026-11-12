import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { UsersService } from '../../../src/users/users.service';

function createService(ownedHouses: number) {
  const existingUser = {
    id: 'owner-1',
    email: 'owner@example.com',
    fullName: 'Owner',
    role: UserRole.OWNER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(existingUser),
      update: jest.fn(({ data }: { data: object }) =>
        Promise.resolve({ ...existingUser, ...data }),
      ),
      delete: jest.fn().mockResolvedValue(existingUser),
    },
    house: {
      count: jest.fn().mockResolvedValue(ownedHouses),
    },
  };

  const service = new UsersService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('UsersService house-owner guard', () => {
  it('blocks changing the role of a user who still owns houses', async () => {
    const { service, prisma } = createService(3);

    await expect(
      service.updateUser('owner-1', { role: UserRole.SECURITY }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks deactivating a house owner through updateUser', async () => {
    const { service, prisma } = createService(1);

    await expect(
      service.updateUser('owner-1', { isActive: false }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks deactivating a house owner through deactivateUser', async () => {
    const { service, prisma } = createService(1);

    await expect(service.deactivateUser('owner-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks deleting a house owner', async () => {
    const { service, prisma } = createService(2);

    await expect(service.deleteUser('owner-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('allows a role change once the user owns no houses', async () => {
    const { service } = createService(0);

    await expect(
      service.updateUser('owner-1', { role: UserRole.SECURITY }),
    ).resolves.toMatchObject({ role: UserRole.SECURITY });
  });

  it('does not check houses for changes that keep the user an active owner', async () => {
    const { service, prisma } = createService(3);

    await expect(
      service.updateUser('owner-1', {
        fullName: 'Renamed Owner',
        role: UserRole.OWNER,
      }),
    ).resolves.toMatchObject({ fullName: 'Renamed Owner' });
    expect(prisma.house.count).not.toHaveBeenCalled();
  });
});
