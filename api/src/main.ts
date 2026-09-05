import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule, ObserveInstrument } from './app.module.js';
import {ConfigService} from "@nestjs/config"; 
async function bootstrap() {
  const configService = new ConfigService();

  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.setGlobalPrefix('v1/api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.enableShutdownHooks();
  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`Project ${configService.get<string>('APP_NAME')!} is running on http://localhost:${port}/api`);
}
await bootstrap();
