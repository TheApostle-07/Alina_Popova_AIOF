import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const revokedSessionSchema = new Schema(
  {
    _id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["member", "admin"],
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  { versionKey: false, timestamps: { createdAt: true, updatedAt: false } }
);

revokedSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RevokedSessionShape = InferSchemaType<typeof revokedSessionSchema>;
export type RevokedSessionDocument = HydratedDocument<RevokedSessionShape>;

export const RevokedSessionModel =
  models.RevokedSession || model("RevokedSession", revokedSessionSchema);
