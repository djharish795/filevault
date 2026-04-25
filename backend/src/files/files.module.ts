import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [StorageModule, PrismaModule],
  controllers: [FilesController],
})
export class FilesModule {}
