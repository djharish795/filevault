import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';

@Module({
  imports: [],
  controllers: [FoldersController],
})
export class FoldersModule {}
