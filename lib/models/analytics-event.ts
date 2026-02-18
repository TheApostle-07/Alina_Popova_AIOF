import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const analyticsEvents = [
  "page_view",
  "checkout_start",
  "checkout_success",
  "cta_click",
  "heatmap_click",
  "scroll_depth",
  "page_exit",
  "restore_request",
  "restore_success"
] as const;

const analyticsEventSchema = new Schema(
  {
    event: {
      type: String,
      enum: analyticsEvents,
      required: true,
      index: true
    },
    path: {
      type: String,
      index: true
    },
    sessionId: {
      type: String,
      index: true
    },
    referrer: {
      type: String,
      index: true
    },
    countryCode: {
      type: String,
      index: true
    },
    country: {
      type: String,
      index: true
    },
    regionCode: {
      type: String,
      index: true
    },
    region: {
      type: String,
      index: true
    },
    city: {
      type: String,
      index: true
    },
    lat: Number,
    lng: Number,
    device: {
      type: String,
      enum: ["mobile", "tablet", "desktop", "unknown"],
      default: "unknown"
    },
    x: Number,
    y: Number,
    scrollDepth: Number,
    dwellMs: Number,
    label: String,
    date: {
      type: String,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 60 * 60 * 24 * 45
    }
  },
  {
    versionKey: false
  }
);

analyticsEventSchema.index({ event: 1, createdAt: -1 });
analyticsEventSchema.index({ path: 1, event: 1, createdAt: -1 });
analyticsEventSchema.index({ countryCode: 1, createdAt: -1 });
analyticsEventSchema.index({ countryCode: 1, regionCode: 1, createdAt: -1 });

export type AnalyticsEventShape = InferSchemaType<typeof analyticsEventSchema>;
export type AnalyticsEventDocument = HydratedDocument<AnalyticsEventShape>;

export const AnalyticsEventModel =
  models.AnalyticsEvent || model("AnalyticsEvent", analyticsEventSchema);
