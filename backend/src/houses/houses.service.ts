import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class HousesService {
  constructor(private prisma: PrismaService) {}

  async createHouse(createHouseDto: CreateHouseDto) {
    const { houseNumber, block, ownerId } = createHouseDto;

    // Validate owner exists and has OWNER role
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new NotFoundException('Owner not found');
    }

    if (owner.role !== UserRole.OWNER) {
      throw new BadRequestException('User must have OWNER role to own a house');
    }

    if (!owner.isActive) {
      throw new BadRequestException('Owner must be an active user');
    }

    // Check for duplicate house number in same block
    const existingHouse = await this.prisma.house.findFirst({
      where: {
        houseNumber,
        block,
      },
    });

    if (existingHouse) {
      throw new ConflictException(
        `House with number ${houseNumber} in block ${block || 'default'} already exists`,
      );
    }

    const house = await this.prisma.house.create({
      data: {
        houseNumber,
        block,
        ownerId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return house;
  }

  async getAllHouses() {
    return this.prisma.house.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getHousesByOwnerId(ownerId: string) {
    return this.prisma.house.findMany({
      where: { ownerId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async getHouseById(id: string) {
    const house = await this.prisma.house.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    return house;
  }

  async updateHouse(id: string, updateHouseDto: UpdateHouseDto) {
    // Check if house exists
    await this.getHouseById(id);

    // If changing owner, validate new owner
    if (updateHouseDto.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: updateHouseDto.ownerId },
      });

      if (!owner) {
        throw new NotFoundException('Owner not found');
      }

      if (owner.role !== UserRole.OWNER) {
        throw new BadRequestException(
          'User must have OWNER role to own a house',
        );
      }

      if (!owner.isActive) {
        throw new BadRequestException('Owner must be an active user');
      }
    }

    // Check for duplicate house number in same block
    if (updateHouseDto.houseNumber || updateHouseDto.block) {
      const currentHouse = await this.getHouseById(id);

      const existingHouse = await this.prisma.house.findFirst({
        where: {
          houseNumber: updateHouseDto.houseNumber || currentHouse.houseNumber,
          block:
            updateHouseDto.block !== undefined
              ? updateHouseDto.block
              : currentHouse.block,
          id: { not: id },
        },
      });

      if (existingHouse) {
        throw new ConflictException(
          `House with number ${updateHouseDto.houseNumber || currentHouse.houseNumber} in block ${updateHouseDto.block !== undefined ? updateHouseDto.block : currentHouse.block || 'default'} already exists`,
        );
      }
    }

    const house = await this.prisma.house.update({
      where: { id },
      data: updateHouseDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return house;
  }

  async deleteHouse(id: string) {
    // Check if house exists
    await this.getHouseById(id);

    const visitTokensCount = await this.prisma.visitToken.count({
      where: { houseId: id },
    });

    if (visitTokensCount > 0) {
      throw new BadRequestException(
        'Cannot delete house with visitor passes. Deactivate related passes first.',
      );
    }

    await this.prisma.house.delete({
      where: { id },
    });

    return { message: 'House deleted successfully' };
  }
}
