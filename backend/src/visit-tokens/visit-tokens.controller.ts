import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import {
  CreateVisitTokenDto,
  ValidateVisitTokenDto,
} from './dto/visit-token.dto';
import { VisitTokensService } from './visit-tokens.service';

@Controller('visit-tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitTokensController {
  constructor(private readonly visitTokensService: VisitTokensService) {}

  @Post()
  @Roles(UserRole.OWNER)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createVisitTokenDto: CreateVisitTokenDto,
  ) {
    return this.visitTokensService.create(user.id, createVisitTokenDto);
  }

  @Post('validate')
  @Roles(UserRole.SECURITY)
  async validate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() validateVisitTokenDto: ValidateVisitTokenDto,
  ) {
    return this.visitTokensService.validate(user.id, validateVisitTokenDto);
  }

  @Get('my')
  @Roles(UserRole.OWNER)
  async getMyTokens(@CurrentUser() user: AuthenticatedUser) {
    return this.visitTokensService.getMyTokens(user.id);
  }

  @Get('recent')
  @Roles(UserRole.SECURITY)
  async getRecentTokens() {
    return this.visitTokensService.getRecentTokens();
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async getAllTokens(@CurrentUser() user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can view all visit tokens');
    }

    return this.visitTokensService.getAllTokens();
  }

  @Patch(':id/admin-deactivate')
  @Roles(UserRole.ADMIN)
  async adminDeactivate(@Param('id') id: string) {
    return this.visitTokensService.deactivateAsAdmin(id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.OWNER)
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.visitTokensService.deactivate(user.id, id);
  }
}
