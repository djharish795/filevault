import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class FolderAccess extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Folder', required: true })
  folderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  grantedBy?: Types.ObjectId;
}

export const FolderAccessSchema = SchemaFactory.createForClass(FolderAccess);
FolderAccessSchema.index({ folderId: 1, userId: 1 }, { unique: true });
