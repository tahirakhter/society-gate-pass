import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { EntryLogQueryDto } from './dto/entry-log.dto';
import { EntryLogsService } from './entry-logs.service';

@Controller('entry-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EntryLogsController {
  constructor(private readonly entryLogsService: EntryLogsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SECURITY)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EntryLogQueryDto,
  ) {
    return this.entryLogsService.findAll(user, query);
  }
}
