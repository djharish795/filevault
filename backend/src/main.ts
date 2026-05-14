import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cookie parsing for HttpOnly refresh tokens
  app.use(cookieParser());

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS configuration
  // Allow all origins for mobile app compatibility (Flutter doesn't send Origin header)
  // In production, mobile apps make direct HTTP requests without CORS restrictions
  app.enableCors({
    origin: true, // Allow all origins (required for mobile apps)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('SecureVault DMS API')
    .setDescription('Document Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  // Must bind to 0.0.0.0 for Railway (and any container/cloud deployment).
  // Binding to localhost (default) makes the server unreachable from outside.
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on port ${port}`);
  console.log(`Swagger docs: /docs`);
}
bootstrap();
