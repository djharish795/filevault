import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';

@Module({
  imports: [],
  controllers: [FilesController],
})
export class FilesModule {}
