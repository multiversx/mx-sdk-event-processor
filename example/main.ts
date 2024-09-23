import { NestFactory } from '@nestjs/core';
import { EventProcessorModule } from "./crons/event.processor.module";

async function start() {
    const eventProcessorApp = await NestFactory.create(EventProcessorModule);
    await eventProcessorApp.listen(4242);
}

start().then()
