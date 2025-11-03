import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
   app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    // forbidNonWhitelisted: true,
    transform: true, // This is important!
  }));
   app.enableCors({
    origin: ['http://localhost:3000'], // Frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // allow cookies or auth headers
  });
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
