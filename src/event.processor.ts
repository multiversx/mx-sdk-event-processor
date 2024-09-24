import axios from "axios";

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
      throw new Error(`Cannot get the last processed timestamp via the provided getLastProcessedTimestamp()`);
    }

    await this.callElasticsearchEvents(maxHeight);
  }

  async callElasticsearchEvents(lastProcessedTimestamp: number): Promise<void> {
    try {
      const url = `${this.options.elasticUrl}/events/_search?scroll=${this.options.scrollTimeout}`;
      const elasticQuery = this.generateElasticsearchQuery(lastProcessedTimestamp);
      const result = await axios.post(url, elasticQuery);

      if (!result.data || !result.data.hits || !result.data.hits || !result.data.hits.hits) {
        return;
      }

      const elasticEvents = result.data.hits.hits;
      const events = elasticEvents.map((e: { _source: any; }) => e._source);
      await this.handleElasticEvents(events);

      const scrollId = result.data._scroll_id;
      while (true) {
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
    if (events.length === 0) {
      return;
    }

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

  generateElasticsearchQuery(timestamp: number) {
    return {
      size: this.options.pageSize,
      query: {
        bool: {
          must: [
            {
              terms: {
                identifier: this.options.eventIdentifiers, // Query by identifiers
              },
            },
            {
              terms: {
                address: this.options.emitterAddresses, // Query by addresses
              },
            },
            {
              range: {
                timestamp: {
                  gt: `${timestamp}`,
                },
              },
            },
          ],
        },
      },
      sort: [
        {
          timestamp: {
            order: 'asc', // Sorting by timestamp in ascending order
          },
        },
      ],
    };
  }
}

export class EventProcessorOptions {
  elasticUrl?: string;
  emitterAddresses?: string[];
  eventIdentifiers?: string[];
  pageSize?: number = 10000;
  scrollTimeout?: string = "1m";
  onEventsReceived?: (highestTimestamp: number, events: EventSource[]) => Promise<void>;
  getLastProcessedTimestamp?: () => Promise<number | undefined>;
  setLastProcessedTimestamp?: (timestamp: number) => Promise<void>;

  constructor(options: Partial<EventProcessorOptions> = {}) {
    Object.assign(this, options);
  }
}

export class EventSource {
  originalTxHash?: string;
  logAddress?: string;
  identifier?: string;
  address?: string;
  topics?: string[];
  shardID?: number;
  additionalData?: string[];
  txOrder?: number;
  txHash?: string;
  order?: number;
  timestamp?: number;
}
