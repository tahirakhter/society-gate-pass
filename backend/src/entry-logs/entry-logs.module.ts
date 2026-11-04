import { Module } from '@nestjs/common';
import { EntryLogsController } from './entry-logs.controller';
import { EntryLogsService } from './entry-logs.service';

@Module({
  controllers: [EntryLogsController],
  providers: [EntryLogsService],
})
export class EntryLogsModule {}
