import { InferSchemaType, model, models, Schema, type HydratedDocument } from "mongoose";

const supportTicketSchema = new Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    topic: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true
    }
  },
  { timestamps: true }
);

export type SupportTicketShape = InferSchemaType<typeof supportTicketSchema>;
export type SupportTicketDocument = HydratedDocument<SupportTicketShape>;

export const SupportTicketModel = models.SupportTicket || model("SupportTicket", supportTicketSchema);
