import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformResponseInterceptor } from './utils/interceptorResponse';
import { HttpExceptionFilter } from './utils/HttpExceptionsFilter';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:3001/', // desarrollo local
      'http://localhost:3000/', // desarrollo local sin levantar el backend en local
      'http://localhost:3001', // desarrollo local
      'http://localhost:3000', // desarrollo local sin levantar el backend en local
      'https://gastonfinance.vercel.app/', // producción
      'https://gastonfinance.vercel.app', // producción
      'https://5kzti-biaaa-aaaae-abmaq-cai.icp0.io', // producción mainnet
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(3000, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 App running on: http://localhost:3000`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
