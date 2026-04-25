import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { FilesModule } from './files/files.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { SharingModule } from './sharing/sharing.module';
import { AdminModule } from './admin/admin.module';
import { FoldersModule } from './folders/folders.module';

@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, FilesModule, SearchModule, StorageModule, SharingModule, AdminModule, FoldersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
