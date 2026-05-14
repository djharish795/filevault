import { Module } from '@nestjs/common';
import { SharingController } from './sharing.controller';

@Module({
  imports: [],
  controllers: [SharingController],
})
export class SharingModule {}
