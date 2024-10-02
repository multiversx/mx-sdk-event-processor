# Event Processor for JavaScript

Event processor for JavaScript and TypeScript (written in TypeScript).

## Distribution

[npm](https://www.npmjs.com/package/@multiversx/sdk-event-processor)

## Usage

```js
let eventProcessor = new EventProcessor();
await eventProcessor.start({
    elasticUrl: 'https://index.multiversx.com',
    eventIdentifiers: ['swapTokensFixedInput'],
    emitterAddresses: ['erd1qqqqqqqqqqqqqpgqt0uek344kaerr4gf9g2r8l0f4l8ygyha2jps82u9r6'],
    pageSize: 1000,
    scrollTimeout: "1m",
    getLastProcessedTimestamp: async () => {
        return lastProcessedTimestamp;
    },
    setLastProcessedTimestamp: async (timestamp: number) => {
        lastProcessedTimestamp = timestamp;
    },
    onEventsReceived: async (highestTimestamp, events) => {
        console.log(`Received ${events.length} events with the highest timestamp ${highestTimestamp}`);
    },
});
```

## Example

The [example](example) directory contains an example script that illustrates how to use the event processor.

```bash
ts-node example/example.ts
```
