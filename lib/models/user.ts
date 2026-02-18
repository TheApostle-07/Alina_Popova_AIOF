import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

export type UserShape = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserShape>;

export const UserModel = models.User || model("User", userSchema);
