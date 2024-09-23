import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventProcessorService } from './event.processor.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
  ],
  providers: [
    EventProcessorService,
  ],
})

export class EventProcessorModule {}
