import { EventProcessorOptions } from "../types/event.processor.options";

export function generateElasticsearchQuery(timestamp: number, options: EventProcessorOptions) {
  return {
    size: options.pageSize,
    query: {
      bool: {
        must: [
          {
            terms: {
              identifier: options.eventIdentifiers, // Query by identifiers
            },
          },
          {
            terms: {
              address: options.emitterAddresses, // Query by addresses
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
