import { EventProcessorOptions } from "../types/event.processor.options";

export function generateElasticsearchQuery(timestamp: number, options: EventProcessorOptions) {
  const mustClauses = [];

  if (options.eventIdentifiers && options.eventIdentifiers.length > 0) {
    mustClauses.push({
      terms: {
        identifier: options.eventIdentifiers,
      },
    });
  }

  if (options.emitterAddresses && options.emitterAddresses.length > 0) {
    mustClauses.push({
      terms: {
        address: options.emitterAddresses,
      },
    });
  }

  return {
    size: options.pageSize,
    query: {
      bool: {
        must: mustClauses,
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
