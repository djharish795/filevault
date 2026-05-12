import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Resolves minimal hierarchical visibility for a user within a project.
   * Returns IDs of folders that are either explicitly shared, contain shared files,
   * or are ancestors required to reach such folders.
   */
  async getVisibleFolderIds(projectId: string, userId: string): Promise<Set<string>> {
    const [folderAccess, accessibleFiles] = await Promise.all([
      this.folderAccess.findMany({
        where: { userId },
        select: { folderId: true },
      }),
      this.file.findMany({
        where: {
          projectId,
          OR: [
            { ownerId: userId },
            { sharedWith: { some: { userId } } },
          ],
        },
        select: { folderId: true },
      }),
    ]);

    const baseIds = new Set<string>();
    folderAccess.forEach((a) => baseIds.add(a.folderId));
    accessibleFiles.forEach((f) => {
      if (f.folderId) baseIds.add(f.folderId);
    });

    const allFolders = await this.folder.findMany({
      where: { projectId },
      select: { id: true, parentId: true },
    });

    const parentMap = new Map<string, string>();
    allFolders.forEach((f) => {
      if (f.parentId) parentMap.set(f.id, f.parentId);
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
