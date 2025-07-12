import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformResponseInterceptor } from './utils/interceptorResponse';
import { HttpExceptionFilter } from './utils/HttpExceptionsFilter';

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

  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: [
      'http://localhost:3001', // desarrollo local
      'https://gaston-web-client-git-master-juan-velozos-projects.vercel.app/', // producción
      'https://gaston-web-client-git-develop-juan-velozos-projects.vercel.app', // rama develop
    ],
  });
  await app.listen(3000);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 App running on: http://localhost:3000`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
