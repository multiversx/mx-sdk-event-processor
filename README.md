# Event Processor for JavaScript

Event processor for JavaScript and TypeScript (written in TypeScript).

## Distribution

[npm](https://www.npmjs.com/package/@multiversx/sdk-event-processor)

## Usage

```js
let eventProcessor = new EventProcessor();
await eventProcessor.start({
  onEventsReceived: (highestTimestamp, events) => {
    console.log(`Received ${events.length} events with the latest timestamp ${highestTimestamp}`);
  },
});
```

[Here](example) is a full application ready to play with in.
