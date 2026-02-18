import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const webhookEventSchema = new Schema(
  {
    _id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      index: true
    },
    processedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    payloadHash: {
      type: String,
      required: true
    }
  },
  { versionKey: false }
);

webhookEventSchema.index({ processedAt: -1 });

export type WebhookEventShape = InferSchemaType<typeof webhookEventSchema>;
export type WebhookEventDocument = HydratedDocument<WebhookEventShape>;

export const WebhookEventModel = models.WebhookEvent || model("WebhookEvent", webhookEventSchema);
