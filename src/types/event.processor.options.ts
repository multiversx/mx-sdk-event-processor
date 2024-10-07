import { EventSource } from "./elastic.event.source";

/**
 * Options for configuring the Event Processor.
 */
export class EventProcessorOptions {
  /**
   * URL of the Elasticsearch instance to connect to.
   * @type {string | undefined}
   */
  elasticUrl?: string;

  /**
   * List of emitter addresses to filter events by.
   * @type {string[] | undefined}
   */
  emitterAddresses?: string[];

  /**
   * List of event identifiers to filter events by.
   * @type {string[] | undefined}
   */
  eventIdentifiers?: string[];

  /**
   * Shard ID to filter events by. Useful for example for ESDT transfers when a log will be issued on both source and destination shard
   * @type {number | undefined}
   */
  shardId?: number;

  /**
   * Number of events to process per page. Defaults to 10,000.
   * @type {number}
   * @default 10000
   */
  pageSize?: number = 10000;

  /**
   * Scroll timeout duration for Elasticsearch queries.
   * Specifies how long Elasticsearch should keep the search context alive between scroll requests.
   * Defaults to "1m" (1 minute).
   * @type {string}
   * @default "1m"
   */
  scrollTimeout?: string = "1m";

  /**
   * Delay between sending requests, in milliseconds.
   * This prevents overwhelming the Elasticsearch server with requests and is useful when there is a possibility of being rate limited by public instances.
   * Defaults to 100 milliseconds.
   * @type {number}
   * @default 100
   */
  delayBetweenRequestsInMilliseconds?: number = 100;

  /**
   * Callback that is triggered when events are received.
   * The function takes the highest timestamp and the received events as arguments.
   * Can return either a `void` or a `Promise<void>` if asynchronous processing is required.
   * @type {(highestTimestamp: number, events: EventSource[]) => void | Promise<void>}
   */
  onEventsReceived?: (highestTimestamp: number, events: EventSource[]) => void | Promise<void>;

  /**
   * Callback to retrieve the last processed timestamp.
   * Should return a `Promise` that resolves to the last processed timestamp, or `undefined` if there is none.
   * @type {() => Promise<number | undefined>}
   */
  getLastProcessedTimestamp?: () => Promise<number | undefined>;

  /**
   * Callback to set the last processed timestamp.
   * Takes a timestamp as an argument and returns a `Promise<void>`.
   * @type {(timestamp: number) => Promise<void>}
   */
  setLastProcessedTimestamp?: (timestamp: number) => Promise<void>;


  constructor(options: Partial<EventProcessorOptions> = {}) {
    Object.assign(this, options);
  }
}
