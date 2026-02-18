import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const metricsDailySchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    visits: {
      type: Number,
      default: 0
    },
    checkoutStarts: {
      type: Number,
      default: 0
    },
    ctaClicks: {
      type: Number,
      default: 0
    },
    successfulSubs: {
      type: Number,
      default: 0
    },
    activeMembers: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export type MetricsDailyShape = InferSchemaType<typeof metricsDailySchema>;
export type MetricsDailyDocument = HydratedDocument<MetricsDailyShape>;

export const MetricsDailyModel = models.MetricsDaily || model("MetricsDaily", metricsDailySchema);
