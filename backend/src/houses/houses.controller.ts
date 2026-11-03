import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HousesService } from './houses.service';
import {
  AssignHouseOwnerDto,
  CreateHouseDto,
  UpdateHouseDto,
} from './dto/house.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { UserRole } from '@prisma/client';

@Controller('houses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HousesController {
  constructor(private housesService: HousesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createHouseDto: CreateHouseDto) {
    return this.housesService.createHouse(createHouseDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll() {
    return this.housesService.getAllHouses();
  }

  @Get('my')
  @Roles(UserRole.OWNER)
  async getMyHouses(@CurrentUser() user: AuthenticatedUser) {
    return this.housesService.getHousesByOwnerId(user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateHouseDto: UpdateHouseDto,
  ) {
    return this.housesService.updateHouse(id, updateHouseDto);
  }

  @Patch(':id/assign-owner')
  @Roles(UserRole.ADMIN)
  async assignOwner(
    @Param('id') id: string,
    @Body() updateHouseDto: AssignHouseOwnerDto,
  ) {
    return this.housesService.updateHouse(id, updateHouseDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.housesService.deleteHouse(id);
  }
}
