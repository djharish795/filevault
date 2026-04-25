import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ensure /uploads folder exists
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve /uploads as static files → GET /uploads/filename.ext
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // Cookie parsing for HttpOnly refresh tokens
  app.use(cookieParser());

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS for React frontend
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
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
  await app.listen(port);
  console.log(`Backend running on: http://localhost:${port}`);
  console.log(`Uploaded files served at: http://localhost:${port}/uploads/<filename>`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}
bootstrap();
