import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { VisitTokensController } from './visit-tokens.controller';
import { VisitTokensService } from './visit-tokens.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [VisitTokensController],
  providers: [VisitTokensService],
  exports: [VisitTokensService],
})
export class VisitTokensModule {}
