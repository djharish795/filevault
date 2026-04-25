import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FoldersController],
})
export class FoldersModule {}
