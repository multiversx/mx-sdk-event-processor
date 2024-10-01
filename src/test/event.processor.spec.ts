import { EventProcessor } from "../event.processor";

describe('EventProcessor', () => {
  it('the instance should be defined', () => {
    const eventProcessor = new EventProcessor();
    expect(eventProcessor).toBeDefined();
  });

  it('should return errors if options are wrong', async () => {
    const eventProcessor = new EventProcessor();

    // empty options
    await expect(eventProcessor.start({})).rejects.toThrow(/No emitter address or identifier set/);

    // empty timestamp function
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
    })).rejects.toThrow(/Undefined function for getting the last processed timestamp/);

    // undefined timestamp returned
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => undefined,
    })).rejects.toThrow(/Cannot get the last processed timestamp via the provided getLastProcessedTimestamp/);

    // missing elastic url
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
    })).rejects.toThrow(/Missing elasticUrl/);

    // missing onReceivedEvents
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://index.multiversx.com',
    })).rejects.toThrow(/Missing onEventsReceived callback function/);

    // missing onReceivedEvents
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://index.multiversx.com',
      onEventsReceived: async () => {},
    })).rejects.toThrow(/Missing setLastProcessedTimestamp callback function/);

    // missing onReceivedEvents
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://index.multiversx.com',
      onEventsReceived: async () => {},
    })).rejects.toThrow(/Missing setLastProcessedTimestamp callback function/);
  });

  it('should return error if Elasticsearch cannot be queried', async () => {
    const eventProcessor = new EventProcessor();
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://httpbin.org/status/404',
      onEventsReceived: async () => {},
      setLastProcessedTimestamp: async (timestamp: number) => {}
    })).rejects.toThrow(/Error while fetching events from Elasticsearch/);
  });
});
