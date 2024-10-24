// models/WebhookData.js
import mongoose from "mongoose";

const webhookDataSchema = new mongoose.Schema({
  resource: String,
  type: String,
  data: {
    id: String, // Adicione este campo para armazenar o ID do pagamento
  },
  createdAt: { type: Date, default: Date.now },
});

const WebhookData = mongoose.model("WebhookData", webhookDataSchema);

export default WebhookData;
