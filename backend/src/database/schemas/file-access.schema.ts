import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class FileAccess extends Document {
  @Prop({ type: Types.ObjectId, ref: 'File', required: true })
  fileId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
}

export const FileAccessSchema = SchemaFactory.createForClass(FileAccess);
FileAccessSchema.index({ fileId: 1, userId: 1 }, { unique: true });
