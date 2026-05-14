import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from './schemas/user.schema';
import { Project, ProjectSchema } from './schemas/project.schema';
import { Folder, FolderSchema } from './schemas/folder.schema';
import { File, FileSchema } from './schemas/file.schema';
import { ProjectMember, ProjectMemberSchema } from './schemas/project-member.schema';
import { FileAccess, FileAccessSchema } from './schemas/file-access.schema';
import { FolderAccess, FolderAccessSchema } from './schemas/folder-access.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: File.name, schema: FileSchema },
      { name: ProjectMember.name, schema: ProjectMemberSchema },
      { name: FileAccess.name, schema: FileAccessSchema },
      { name: FolderAccess.name, schema: FolderAccessSchema },
      { name: Message.name, schema: MessageSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [DatabaseService],
  exports: [MongooseModule, DatabaseService],
})
export class DatabaseModule {}
