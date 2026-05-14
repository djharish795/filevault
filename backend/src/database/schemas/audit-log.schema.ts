import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ 
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class AuditLog extends Document {
  @Prop({ required: true })
  action: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project' })
  projectId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'File' })
  fileId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: any;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ projectId: 1 });
AuditLogSchema.index({ fileId: 1 });
AuditLogSchema.index({ createdAt: 1 });
