import { Module } from '@nestjs/common';
import { SharingController } from './sharing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SharingController],
})
export class SharingModule {}
