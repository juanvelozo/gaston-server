import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: 'http://localhost:5173', // o el dominio de tu frontend
  }); // si vas a usar frontend separado
  await app.listen(3000);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 App running on: http://localhost:3000`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
