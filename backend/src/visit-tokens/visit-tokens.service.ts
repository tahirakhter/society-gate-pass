import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScanStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

import {
  CreateVisitTokenDto,
  ValidateVisitTokenDto,
} from './dto/visit-token.dto';

type VisitTokenWithRelations = {
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
  visitor: {
    id: string;
    cnic: string;
    fullName: string;
    createdAt: Date;
  };
  house: {
    id: string;
    houseNumber: string;
    ownerId: string;
    block: string | null;
    createdAt: Date;
    owner: {
      id: string;
      fullName: string;
      email: string;
    };
  };
};

@Injectable()
export class VisitTokensService {
  private readonly defaultInclude = {
    visitor: true,
    house: {
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    },
  } as const;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(ownerId: string, createVisitTokenDto: CreateVisitTokenDto) {
    const house = await this.prisma.house.findUnique({
      where: { id: createVisitTokenDto.houseId },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!house) {
      throw new NotFoundException('House not found');
    }

    if (house.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You can only generate visit tokens for your own houses',
      );
    }

    const expiresAt = this.resolveExpiry(createVisitTokenDto);

    const visitor = await this.prisma.visitor.upsert({
      where: { cnic: createVisitTokenDto.cnic },
      update: {
        fullName: createVisitTokenDto.fullName,
      },
      create: {
        cnic: createVisitTokenDto.cnic,
        fullName: createVisitTokenDto.fullName,
      },
    });

    const visitToken = await this.prisma.visitToken.create({
      data: {
        tokenCode: this.generateQrCode(),
        visitorId: visitor.id,
        houseId: house.id,
        carNumber: createVisitTokenDto.carNumber,
        expiresAt,
        createdBy: ownerId,
      },
      include: this.defaultInclude,
    });

    return this.serializeVisitToken(visitToken);
  }

  async getMyTokens(ownerId: string) {
    const tokens = await this.prisma.visitToken.findMany({
      where: {
        OR: [
          { createdBy: ownerId },
          {
            house: {
              ownerId,
            },
          },
        ],
      },
      include: this.defaultInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tokens.map((token) => this.serializeVisitToken(token));
  }

  async getAllTokens() {
    const tokens = await this.prisma.visitToken.findMany({
      include: this.defaultInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tokens.map((token) => this.serializeVisitToken(token));
  }

  async getRecentTokens(limit = 20) {
    const tokens = await this.prisma.visitToken.findMany({
      include: this.defaultInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return tokens.map((token) => this.serializeVisitToken(token));
  }

  async validate(
    scannedBy: string,
    validateVisitTokenDto: ValidateVisitTokenDto,
  ) {
    const tokenCode = validateVisitTokenDto.tokenCode.trim();
    const visitToken = await this.prisma.visitToken.findUnique({
      where: { tokenCode },
      include: this.defaultInclude,
    });

    if (!visitToken) {
      await this.createEntryLog({
        scannedBy,
        scanStatus: ScanStatus.FAILED,
        failureReason: 'Token not found',
      });

      return {
        approved: false,
        status: 'FAILED' as const,
        failureReason: 'Token not found',
        token: null,
      };
    }

    const failureReason = this.getValidationFailureReason(visitToken);

    if (failureReason) {
      await this.createEntryLog({
        scannedBy,
        tokenId: visitToken.id,
        scanStatus: ScanStatus.FAILED,
        failureReason,
      });

      return {
        approved: false,
        status: 'FAILED' as const,
        failureReason,
        token: this.serializeVisitToken(visitToken),
      };
    }

    const updatedToken = await this.prisma.visitToken.update({
      where: { id: visitToken.id },
      data: {
        isUsed: true,
      },
      include: this.defaultInclude,
    });

    await this.createEntryLog({
      scannedBy,
      tokenId: updatedToken.id,
      scanStatus: ScanStatus.SUCCESS,
    });

    return {
      approved: true,
      status: 'SUCCESS' as const,
      failureReason: null,
      token: this.serializeVisitToken(updatedToken),
    };
  }

  async deactivate(ownerId: string, tokenId: string) {
    const visitToken = await this.prisma.visitToken.findUnique({
      where: { id: tokenId },
      include: {
        house: true,
      },
    });

    if (!visitToken) {
      throw new NotFoundException('Visit token not found');
    }

    if (
      visitToken.house.ownerId !== ownerId &&
      visitToken.createdBy !== ownerId
    ) {
      throw new ForbiddenException(
        'You can only deactivate visit tokens for your own houses',
      );
    }

    this.assertCanDeactivate(visitToken);

    if (!visitToken.isActive) {
      return this.serializeVisitToken(
        await this.prisma.visitToken.findUniqueOrThrow({
          where: { id: tokenId },
          include: this.defaultInclude,
        }),
      );
    }

    const updatedToken = await this.markTokenRevoked(tokenId);

    return this.serializeVisitToken(updatedToken);
  }

  async deactivateAsAdmin(tokenId: string) {
    const visitToken = await this.prisma.visitToken.findUnique({
      where: { id: tokenId },
      include: this.defaultInclude,
    });

    if (!visitToken) {
      throw new NotFoundException('Visit token not found');
    }

    this.assertCanDeactivate(visitToken);

    if (!visitToken.isActive) {
      return this.serializeVisitToken(visitToken);
    }

    const updatedToken = await this.markTokenRevoked(tokenId);

    return this.serializeVisitToken(updatedToken);
  }

  /**
   * Keep the persisted revoke state consistent for every caller. A revoked
   * token must never remain active, regardless of whether the request came
   * from an owner, an admin, or the AI assistant.
   */
  private markTokenRevoked(tokenId: string) {
    return this.prisma.visitToken.update({
      where: { id: tokenId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  private resolveExpiry(createVisitTokenDto: CreateVisitTokenDto): Date {
    if (createVisitTokenDto.expiresAt) {
      const customExpiry = new Date(createVisitTokenDto.expiresAt);
      if (Number.isNaN(customExpiry.getTime())) {
        throw new BadRequestException('Expiry must be a valid future date');
      }

      if (customExpiry <= new Date()) {
        throw new BadRequestException('Expiry must be a future date');
      }

      const maxHours = this.maxExpiryHours;
      const maxExpiryDate = new Date();
      maxExpiryDate.setHours(maxExpiryDate.getHours() + maxHours);

      if (customExpiry > maxExpiryDate) {
        throw new BadRequestException(
          `Expiry cannot exceed ${maxHours} hours from now`,
        );
      }

      return customExpiry;
    }

    const expiryHours =
      createVisitTokenDto.expiryHours ?? this.defaultExpiryHours;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);
    return expiresAt;
  }

  private serializeVisitToken(visitToken: VisitTokenWithRelations) {
    return {
      ...visitToken,
      qrPayload: visitToken.tokenCode,
      status: this.getStatus(visitToken),
    };
  }

  private generateQrCode(): string {
    return `SGP-${randomBytes(24).toString('base64url')}`;
  }

  private getValidationFailureReason(visitToken: {
    isActive: boolean;
    isUsed: boolean;
    expiresAt: Date;
  }): string | null {
    if (!visitToken.isActive) {
      return 'Token has been deactivated';
    }

    if (visitToken.isUsed) {
      return 'Token has already been used';
    }

    if (visitToken.expiresAt < new Date()) {
      return 'Token has expired';
    }

    return null;
  }

  private assertCanDeactivate(visitToken: {
    isActive: boolean;
    isUsed: boolean;
    expiresAt: Date;
  }) {
    if (!visitToken.isActive) {
      throw new BadRequestException('This pass is already revoked.');
    }

    if (visitToken.isUsed) {
      throw new BadRequestException('This pass is already processed.');
    }

    if (visitToken.expiresAt < new Date()) {
      throw new BadRequestException('This pass is already expired.');
    }
  }

  private getStatus(visitToken: {
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

  private createEntryLog(data: {
    scannedBy: string;
    scanStatus: ScanStatus;
    tokenId?: string;
    failureReason?: string;
  }) {
    return this.prisma.entryLog.create({
      data: {
        scannedBy: data.scannedBy,
        scanStatus: data.scanStatus,
        tokenId: data.tokenId,
        failureReason: data.failureReason,
      },
    });
  }

  private get defaultExpiryHours(): number {
    return Number(
      this.configService.get<string>('VISIT_TOKEN_DEFAULT_EXPIRY_HOURS') || 12,
    );
  }

  private get maxExpiryHours(): number {
    return Number(
      this.configService.get<string>('VISIT_TOKEN_MAX_EXPIRY_HOURS') || 72,
    );
  }
}
