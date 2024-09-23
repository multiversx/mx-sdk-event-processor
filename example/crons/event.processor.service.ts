import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Locker } from '../utils/locker';
import { EventProcessor } from "../../src/event.processor";

@Injectable()
export class EventProcessorService {
  private readonly logger: Logger;
  private lastTimestamp: number | undefined;

  constructor() {
    this.logger = new Logger(EventProcessorService.name);
  }

  @Cron('*/1 * * * * *')
  async handleNewMultiversxEvents() {
    Locker.lock('newMultiversxEvents', async () => {
      const eventProcessor = new EventProcessor();
      await eventProcessor.start({
        elasticUrl: 'https://index.multiversx.com',
        eventIdentifiers: ['ESDTTransfer'],
        emitterAddresses: ['erd1r44w4rky0l29pynkp4hrmrjdhnmd5knrrmevarp6h2dg9cu74sas597hhl'],
        pageSize: 1,
        scrollTimeout: "1m",
        getLastProcessedTimestamp: async () => {
          await Promise.resolve();
          return this.lastTimestamp ?? 0;
        },
        setLastProcessedTimestamp: async (timestamp: number) => {
          this.lastTimestamp = timestamp;
        },
        onEventsReceived: async (highestTimestamp, events) => {
          await Promise.resolve();
          console.log(`onEventsReceived -> highestTimestamp: ${highestTimestamp}`);
          console.log(`onEventsReceived -> events: ${JSON.stringify(events)}`);
        },
      });
    });
  }
}
