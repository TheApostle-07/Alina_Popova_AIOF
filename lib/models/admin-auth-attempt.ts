import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const adminAuthAttemptSchema = new Schema(
  {
    identifier: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export type AdminAuthAttemptShape = InferSchemaType<typeof adminAuthAttemptSchema>;
export type AdminAuthAttemptDocument = HydratedDocument<AdminAuthAttemptShape>;

export const AdminAuthAttemptModel =
  models.AdminAuthAttempt || model("AdminAuthAttempt", adminAuthAttemptSchema);
