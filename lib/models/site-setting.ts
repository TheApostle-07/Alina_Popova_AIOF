import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const siteSettingSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global"
    },
    ageModeEnabled: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: String,
      default: "admin"
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export type SiteSettingShape = InferSchemaType<typeof siteSettingSchema>;
export type SiteSettingDocument = HydratedDocument<SiteSettingShape>;

export const SiteSettingModel =
  models.SiteSetting || model("SiteSetting", siteSettingSchema);
