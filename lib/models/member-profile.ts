import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const memberProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 28
    },
    displayNameKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40,
      unique: true,
      index: true
    },
    donationTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      index: true
    },
    avatarSeed: {
      type: String,
      trim: true,
      maxlength: 80
    }
  },
  { timestamps: true }
);

memberProfileSchema.index({ donationTotal: -1, updatedAt: 1, _id: 1 });
memberProfileSchema.index({ displayName: 1 });

export type MemberProfileShape = InferSchemaType<typeof memberProfileSchema>;
export type MemberProfileDocument = HydratedDocument<MemberProfileShape>;

export const MemberProfileModel =
  models.MemberProfile || model("MemberProfile", memberProfileSchema);
