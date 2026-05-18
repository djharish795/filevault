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
    return this.getAccessibleFolderIds(projectId, userId, false);
  }

  /**
   * Reusable central method to get all accessible folder IDs for a user inside a project.
   * Returns explicitly shared folders, folders containing accessible files (owned/shared),
   * and all their parent folders (upward traversal) for breadcrumb path rendering.
   */
  async getAccessibleFolderIds(projectId: string, userId: string, isAdmin: boolean): Promise<Set<string>> {
    const projId = new Types.ObjectId(projectId);
    
    // Admins have access to all folders in the project.
    if (isAdmin) {
      const allFolders = await this.folder.find({ projectId: projId }).select('_id');
      return new Set(allFolders.map(f => f._id.toString()));
    }

    const uId = new Types.ObjectId(userId);

    // 1. Folders explicitly shared with user
    const folderAccesses = await this.folderAccess.find({ userId: uId }).populate({
      path: 'folderId',
      match: { projectId: projId },
      select: '_id',
    });

    // 2. Folders containing files owned by the user
    const ownedFiles = await this.file.find({ projectId: projId, ownerId: uId }).select('folderId');

    // 3. Folders containing files explicitly shared with the user
    const sharedFileAccesses = await this.fileAccess.find({ userId: uId }).populate({
      path: 'fileId',
      match: { projectId: projId },
      select: 'folderId',
    });

    const baseIds = new Set<string>();

    folderAccesses.forEach((fa: any) => {
      if (fa.folderId) {
        baseIds.add(fa.folderId._id.toString());
      }
    });

    ownedFiles.forEach((f: any) => {
      if (f.folderId) {
        baseIds.add(f.folderId.toString());
      }
    });

    sharedFileAccesses.forEach((sfa: any) => {
      if (sfa.fileId && sfa.fileId.folderId) {
        baseIds.add(sfa.fileId.folderId.toString());
      }
    });

    // 4. Trace parents upward to the root (breadcrumb trail) using materialized path ancestry
    const foldersWithPaths = await this.folder.find({
      _id: { $in: Array.from(baseIds).map(id => new Types.ObjectId(id)) }
    }).select('_id parentId path');

    const visibleIds = new Set<string>();
    baseIds.forEach(id => visibleIds.add(id));

    // Fallback parent map resolver for legacy folders without the path property populated
    let parentMap: Map<string, string> | null = null;

    for (const f of foldersWithPaths) {
      if (f.path && f.path.length > 0) {
        // Use high-performance materialized path
        f.path.forEach((ancestorId) => {
          visibleIds.add(ancestorId.toString());
        });
      } else if (f.parentId) {
        // Fallback to recursive traversal for unmigrated legacy folders
        if (!parentMap) {
          const allFolders = await this.folder.find({ projectId: projId }).select('_id parentId');
          parentMap = new Map<string, string>();
          allFolders.forEach((fol) => {
            if (fol.parentId) parentMap!.set(fol._id.toString(), fol.parentId.toString());
          });
        }
        let curr: string | undefined = f.parentId.toString();
        while (curr && !visibleIds.has(curr)) {
          visibleIds.add(curr);
          curr = parentMap.get(curr);
        }
      }
    }

    return visibleIds;
  }

  /**
   * Reusable central method to get all accessible file IDs for a user inside a project.
   * Returns owned files, explicitly shared files, and files residing inside accessible folders.
   */
  async getAccessibleFileIds(projectId: string, userId: string, isAdmin: boolean): Promise<Set<string>> {
    const projId = new Types.ObjectId(projectId);
    
    // Admins have access to all files in the project.
    if (isAdmin) {
      const allFiles = await this.file.find({ projectId: projId }).select('_id');
      return new Set(allFiles.map(f => f._id.toString()));
    }

    const uId = new Types.ObjectId(userId);

    // 1. Files explicitly shared with the user
    const sharedFileAccesses = await this.fileAccess.find({ userId: uId }).populate({
      path: 'fileId',
      match: { projectId: projId },
      select: '_id',
    });

    // 2. Files owned by the user
    const ownedFiles = await this.file.find({ projectId: projId, ownerId: uId }).select('_id');

    // 3. Files residing in folders explicitly shared with the user
    const folderAccesses = await this.folderAccess.find({ userId: uId }).populate({
      path: 'folderId',
      match: { projectId: projId },
      select: '_id',
    });
    const sharedFolderIds = folderAccesses
      .filter((fa: any) => !!fa.folderId)
      .map((fa: any) => fa.folderId._id);

    const folderFiles = await this.file.find({
      projectId: projId,
      folderId: { $in: sharedFolderIds },
    }).select('_id');

    const fileIds = new Set<string>();
    sharedFileAccesses.forEach((fa: any) => {
      if (fa.fileId) fileIds.add(fa.fileId._id.toString());
    });
    ownedFiles.forEach((f: any) => {
      fileIds.add(f._id.toString());
    });
    folderFiles.forEach((f: any) => {
      fileIds.add(f._id.toString());
    });

    return fileIds;
  }

  /**
   * Reusable authorization check for verifying if a user can access a specific folder.
   */
  async canAccessFolder(folderId: string, userId: string, isAdmin: boolean): Promise<boolean> {
    if (isAdmin) return true;
    
    const folder = await this.folder.findById(folderId);
    if (!folder) return false;

    // Check project membership first
    const uId = new Types.ObjectId(userId);
    const member = await this.projectMember.findOne({ projectId: folder.projectId, userId: uId });
    if (!member) return false;

    const visibleIds = await this.getAccessibleFolderIds(folder.projectId.toString(), userId, isAdmin);
    return visibleIds.has(folderId);
  }

  /**
   * Reusable authorization check for verifying if a user can access a specific file.
   */
  async canAccessFile(fileId: string, userId: string, isAdmin: boolean): Promise<boolean> {
    if (isAdmin) return true;

    const file = await this.file.findById(fileId);
    if (!file) return false;

    // Check project membership first
    const uId = new Types.ObjectId(userId);
    const member = await this.projectMember.findOne({ projectId: file.projectId, userId: uId });
    if (!member) return false;

    const accessibleFileIds = await this.getAccessibleFileIds(file.projectId.toString(), userId, isAdmin);
    return accessibleFileIds.has(fileId);
  }

  /**
   * High-performance centralized resolver to fetch all accessible file IDs for a user globally.
   * Eliminates nested looping over projects and prevents repeated database roundtrips.
   */
  async getAllAccessibleFileIds(userId: string, isAdmin: boolean): Promise<Set<string>> {
    const uId = new Types.ObjectId(userId);

    if (isAdmin) {
      const allFiles = await this.file.find().select('_id');
      return new Set(allFiles.map(f => f._id.toString()));
    }

    // 1. Files explicitly shared with the user
    const sharedFileAccesses = await this.fileAccess.find({ userId: uId }).select('fileId');
    const sharedFileIds = sharedFileAccesses
      .filter((fa: any) => !!fa.fileId)
      .map((fa: any) => fa.fileId.toString());

    // 2. Files owned by the user
    const ownedFiles = await this.file.find({ ownerId: uId }).select('_id');
    const ownedFileIds = ownedFiles.map(f => f._id.toString());

    // 3. Files in folders explicitly shared with the user
    const folderAccesses = await this.folderAccess.find({ userId: uId }).select('folderId');
    const sharedFolderIds = folderAccesses
      .filter((fa: any) => !!fa.folderId)
      .map((fa: any) => fa.folderId);

    const folderFiles = await this.file.find({ folderId: { $in: sharedFolderIds } }).select('_id');
    const folderFileIds = folderFiles.map(f => f._id.toString());

    const fileIds = new Set<string>();
    sharedFileIds.forEach(id => fileIds.add(id));
    ownedFileIds.forEach(id => fileIds.add(id));
    folderFileIds.forEach(id => fileIds.add(id));

    return fileIds;
  }
}
