import axios from "axios";
import { EventSource } from "./types/elastic.event.source";
import { EventProcessorOptions } from "./types/event.processor.options";
import { generateElasticsearchQuery } from "./utils/elastic.helpers";

export class EventProcessor {
  private options: EventProcessorOptions = new EventProcessorOptions();

  async start(options: EventProcessorOptions) {
    this.options = options;

    if (!options.emitterAddresses && !options.eventIdentifiers) {
      throw new Error(`No emitter address or identifier set. Could not resolve all the events without filters.`);
    }

    await this.startProcess(options);
  }

  private async startProcess(options: EventProcessorOptions) {
    const lastTimestampFunc = options.getLastProcessedTimestamp;
    if (!lastTimestampFunc) {
      throw new Error(`Undefined function for getting the last processed timestamp`);
    }

    const maxHeight = await lastTimestampFunc();
    if (maxHeight === undefined) {
      throw new Error('Cannot get the last processed timestamp via the provided getLastProcessedTimestamp()');
    }

    if (!this.options.elasticUrl) {
      throw new Error('Missing elasticUrl options');
    }

    if (!this.options.onEventsReceived) {
      throw new Error('Missing onEventsReceived callback function');
    }

    if (!this.options.setLastProcessedTimestamp) {
      throw new Error('Missing setLastProcessedTimestamp callback function');
    }

    await this.callElasticsearchEvents(maxHeight);
  }

  private async callElasticsearchEvents(lastProcessedTimestamp: number): Promise<void> {
    try {
      const url = `${this.options.elasticUrl}/events/_search?scroll=${this.options.scrollTimeout}`;
      const elasticQuery = generateElasticsearchQuery(lastProcessedTimestamp, this.options);
      const result = await axios.post(url, elasticQuery);

      const elasticEvents = result?.data?.hits?.hits ?? [];
      if (elasticEvents.length === 0) {
        return;
      }

      const events = elasticEvents.map((e: { _source: any; }) => e._source);
      await this.handleElasticEvents(events);

      const scrollId = result.data._scroll_id;
      if (!scrollId) {
        return;
      }
      while (true) {
        if (this.options.delayBetweenRequestsInMilliseconds) {
          await new Promise(resolve => setTimeout(resolve, this.options.delayBetweenRequestsInMilliseconds));
        }

        const scrollResult = await axios.post(`${this.options.elasticUrl}/_search/scroll`,
          {
            scroll_id: scrollId,
          });

        const scrollDocuments = scrollResult?.data?.hits?.hits ?? [];
        if (scrollDocuments.length === 0) {
          break;
        }

        const scrollEvents = scrollDocuments.map((e: { _source: any; }) => e._source);
        await this.handleElasticEvents(scrollEvents);
      }
    } catch (error) {
      throw new Error(`Error while fetching events from Elasticsearch: ${error}`);
    }
  }

  async handleElasticEvents(events: EventSource[]) {
    const lastTimestamp = events[events.length - 1].timestamp ?? 0;

    const onEventsFunc = this.options.onEventsReceived;
    if (onEventsFunc) {
      await onEventsFunc(lastTimestamp, events);
    }

    const setLatestProcessedTimestampFunc = this.options.setLastProcessedTimestamp;
    if (setLatestProcessedTimestampFunc) {
      await setLatestProcessedTimestampFunc(lastTimestamp);
    }
  }
}
