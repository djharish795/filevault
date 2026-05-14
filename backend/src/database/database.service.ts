import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema';
import { Project } from './schemas/project.schema';
import { Folder } from './schemas/folder.schema';
import { File } from './schemas/file.schema';
import { FolderAccess } from './schemas/folder-access.schema';
import { FileAccess } from './schemas/file-access.schema';
import { ProjectMember } from './schemas/project-member.schema';
import { Message } from './schemas/message.schema';
import { AuditLog } from './schemas/audit-log.schema';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectModel(User.name) public readonly user: Model<User>,
    @InjectModel(Project.name) public readonly project: Model<Project>,
    @InjectModel(Folder.name) public readonly folder: Model<Folder>,
    @InjectModel(File.name) public readonly file: Model<File>,
    @InjectModel(FolderAccess.name) public readonly folderAccess: Model<FolderAccess>,
    @InjectModel(FileAccess.name) public readonly fileAccess: Model<FileAccess>,
    @InjectModel(ProjectMember.name) public readonly projectMember: Model<ProjectMember>,
    @InjectModel(Message.name) public readonly message: Model<Message>,
    @InjectModel(AuditLog.name) public readonly auditLog: Model<AuditLog>,
  ) {}

  /**
   * Resolves minimal hierarchical visibility for a user within a project.
   */
  async getVisibleFolderIds(projectId: string, userId: string): Promise<Set<string>> {
    const projId = new Types.ObjectId(projectId);
    const uId = new Types.ObjectId(userId);

    const [folderAccess, accessibleFiles] = await Promise.all([
      this.folderAccess.find({ userId: uId }).populate({
        path: 'folderId',
        match: { projectId: projId },
        select: '_id',
      }),
      this.file.find({
        projectId: projId,
        $or: [
          { ownerId: uId },
        ],
      }).select('folderId'),
    ]);

    const sharedFiles = await this.fileAccess.find({ userId: uId }).populate('fileId');
    const sharedFileFolderIds = sharedFiles
      .filter(fa => fa.fileId && (fa.fileId as any).projectId?.toString() === projectId)
      .map(fa => (fa.fileId as any).folderId?.toString())
      .filter(id => !!id);

    const baseIds = new Set<string>();
    
    folderAccess.forEach((a: any) => {
      if (a.folderId) baseIds.add(a.folderId._id.toString());
    });

    accessibleFiles.forEach((f: any) => {
      if (f.folderId) baseIds.add(f.folderId.toString());
    });

    sharedFileFolderIds.forEach(id => baseIds.add(id!));

    const allFolders = await this.folder.find({ projectId: projId }).select('_id parentId');

    const parentMap = new Map<string, string>();
    allFolders.forEach((f) => {
      if (f.parentId) parentMap.set(f._id.toString(), f.parentId.toString());
    });

    const visibleIds = new Set<string>();
    for (const baseId of baseIds) {
      let curr: string | undefined = baseId;
      while (curr && !visibleIds.has(curr)) {
        visibleIds.add(curr);
        curr = parentMap.get(curr);
      }
    }
    return visibleIds;
  }
}
