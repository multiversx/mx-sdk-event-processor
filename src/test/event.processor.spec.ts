import { EventProcessor } from "../event.processor";
import axios from "axios";

// Mock axios.post
jest.mock('axios');

describe('EventProcessor', () => {
  let eventProcessor: EventProcessor;

  beforeEach(() => {
    eventProcessor = new EventProcessor();
    jest.clearAllMocks();
  });

  it('the instance should be defined', () => {
    expect(eventProcessor).toBeDefined();
  });

  it('should throw an error if options are empty', async () => {
    await expect(eventProcessor.start({}))
      .rejects.toThrow(/No emitter address or identifier set/);
  });

  it('should throw an error if the timestamp function is undefined', async () => {
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
    })).rejects.toThrow(/Undefined function for getting the last processed timestamp/);
  });

  it('should throw an error if the timestamp function returns undefined', async () => {
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => undefined,
    })).rejects.toThrow(/Cannot get the last processed timestamp via the provided getLastProcessedTimestamp/);
  });

  it('should throw an error if elasticUrl is missing', async () => {
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
    })).rejects.toThrow(/Missing elasticUrl/);
  });

  it('should throw an error if onEventsReceived is missing', async () => {
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://index.multiversx.com',
    })).rejects.toThrow(/Missing onEventsReceived callback function/);
  });

  it('should throw an error if setLastProcessedTimestamp is missing', async () => {
    await expect(eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://index.multiversx.com',
      onEventsReceived: async () => {},
    })).rejects.toThrow(/Missing setLastProcessedTimestamp callback function/);
  });

  it('should work but no item matches the filters', async () => {
    const eventProcessor = new EventProcessor();
    let receivedEvents: any[] = [];
    const mockResponse = createElasticSearchResponse();

    // Mock axios.post to return a resolved Promise with mockResponse
    (axios.post as jest.Mock).mockResolvedValue(mockResponse);

    await eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://myelastic.com',
      onEventsReceived: async (highestTimestamp, events) => {receivedEvents = events;},
      setLastProcessedTimestamp: async (timestamp: number) => {},
    });

    expect(receivedEvents?.length).toBe(0);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('should return no items if invalid Elasticsearch response', async () => {
    let receivedEvents: any[] = [];

    // Mock axios.post to return a resolved Promise with mockResponse
    (axios.post as jest.Mock).mockResolvedValue({ invalid: 'response' });

    await eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://httpbin.com/404',
      onEventsReceived: async (highestTimestamp, events) => {receivedEvents = events;},
      setLastProcessedTimestamp: async (timestamp: number) => {},
    });

    expect(receivedEvents?.length).toBe(0);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('should work and receive events', async () => {
    let receivedEvents: any[] = [];
    const mockResponse1 = createElasticSearchResponse(123);
    const mockResponse2 = createElasticSearchResponse();

    // Mock axios.post to return a resolved Promise with mockResponse
    (axios.post as jest.Mock)
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    await eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://myelastic.com',
      onEventsReceived: async (highestTimestamp, events) => {receivedEvents = events;},
      setLastProcessedTimestamp: async (timestamp: number) => {},
    });

    expect(receivedEvents?.length).toBe(1);
    expect(receivedEvents[0].timestamp).toEqual(123);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('should work and receive events with provided page size', async () => {
    let receivedEvents: any[] = [];
    const mockResponse1 = createElasticSearchResponse(0, 1, 2, 3);
    const mockResponse2 = createElasticSearchResponse(4, 5, 6);
    const mockResponse3 = createElasticSearchResponse();
    // Mock axios.post to return a resolved Promise with mockResponse
    (axios.post as jest.Mock)
      .mockResolvedValueOnce(mockResponse1) // 1st call
      .mockResolvedValueOnce(mockResponse2) // 2nd call
      .mockResolvedValueOnce(mockResponse3); // 3rd call (empty to stop scrolling)

    await eventProcessor.start({
      emitterAddresses: ['erd1nz88q5pevl6up2qxsgpqgc0qmnm93lh888wwwa68kmz363kdwz9q8tnems'],
      getLastProcessedTimestamp: async () => 37,
      elasticUrl: 'https://myelastic.com',
      onEventsReceived: async (highestTimestamp, events) => {receivedEvents.push(...events);},
      setLastProcessedTimestamp: async (timestamp: number) => {},
      pageSize: 10,
    });

    expect(receivedEvents?.length).toBe(7);
    for (let i = 0; i < 7; i++) {
      expect(receivedEvents[i].timestamp).toEqual(i);
    }
    expect(axios.post).toHaveBeenCalledTimes(3);
  });
});

function createElasticSearchResponse(...timestamps: number[]) {
  const hits = timestamps.map((timestamp, index) => ({
    _id: (index + 1).toString(), // Create unique _id based on index
    _source: { timestamp },      // Use the provided timestamp
  }));

  return {
    data: {
      _scroll_id: 'scrollId',
      hits: {
        hits,
      },
    },
  };
}
