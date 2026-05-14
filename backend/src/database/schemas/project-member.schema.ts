import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ProjectMember extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
}

export const ProjectMemberSchema = SchemaFactory.createForClass(ProjectMember);
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
