import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly uploadDir: string;

  constructor() {
    // Resolve /uploads relative to the project root (backend/)
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  /** Create /uploads folder if it doesn't exist */
  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadDir}`);
    }
  }

  /** Build the public URL path for a stored file */
  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  /** Delete a file from disk by its stored filename */
  deleteFile(filename: string): void {
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Deleted file: ${filePath}`);
    }
  }

  /** Validate MIME type and file size before accepting upload */
  validateFile(
    originalName: string,
    fileSize: number,
    mimeType: string,
  ): { isValid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (fileSize > maxSize) {
      return { isValid: false, error: 'File size exceeds 50 MB limit' };
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv',
    ];

    if (!allowedTypes.includes(mimeType)) {
      return { isValid: false, error: `File type "${mimeType}" is not allowed` };
    }

    return { isValid: true };
  }
}
