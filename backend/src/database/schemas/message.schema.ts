import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Folder', required: true })
  folderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ default: 'text' })
  messageType: string;

  @Prop()
  text?: string;

  @Prop({ type: Types.ObjectId, ref: 'File' })
  fileId?: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ folderId: 1, createdAt: 1 });
