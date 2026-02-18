import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";
import { CONTENT_STATES, CONTENT_TYPES } from "@/lib/constants";

const contentSchema = new Schema(
  {
    type: {
      type: String,
      enum: CONTENT_TYPES,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    tags: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: CONTENT_STATES,
      default: "draft",
      index: true
    },
    publishAt: {
      type: Date,
      index: true
    },
    previewEligible: {
      type: Boolean,
      default: true,
      index: true
    },
    previewUrl: {
      type: String,
      required: true
    },
    mediaAssetId: {
      type: String,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

contentSchema.index({ status: 1, publishAt: -1, createdAt: -1 });
contentSchema.index({ status: 1, type: 1, publishAt: -1, _id: -1 });
contentSchema.index({ tags: 1, status: 1, publishAt: -1 });
contentSchema.index({ status: 1, _id: -1 });

export type ContentShape = InferSchemaType<typeof contentSchema>;
export type ContentDocument = HydratedDocument<ContentShape>;

export const ContentModel = models.Content || model("Content", contentSchema);
