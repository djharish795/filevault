import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Folder extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  /// null / undefined = root-level folder; set = nested subfolder
  @Prop({ type: Types.ObjectId, ref: 'Folder', default: null })
  parentId?: Types.ObjectId | null;

  /// Materialized path: list of ancestor folder ObjectIds from root down to parent
  @Prop({ type: [Types.ObjectId], ref: 'Folder', default: [] })
  path: Types.ObjectId[];
}

export const FolderSchema = SchemaFactory.createForClass(Folder);

// Index for fetching children of a folder efficiently.
FolderSchema.index({ parentId: 1 });
// Compound index for root-folder listing per project.
FolderSchema.index({ projectId: 1, parentId: 1 });
// Index for ancestor-based lookups and path traversal queries.
FolderSchema.index({ path: 1 });
