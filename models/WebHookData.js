// models/WebhookData.js
import mongoose from "mongoose";

const webhookDataSchema = new mongoose.Schema({
  resource: String,
  createdAt: { type: Date, default: Date.now },
});

const WebhookData = mongoose.model("WebhookData", webhookDataSchema);

export default WebhookData;
