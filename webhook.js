import express from "express";
import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { sendEmail } from "./server.js"; // Altere para o caminho correto
import WebhookData from "./models/WebHookData.js";

dotenv.config();

const router = express.Router();

// Variáveis globais
let lastDeliveryData = null;
let lastItems = [];
let lastShipCoast = 0;

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Conectado ao MongoDB!");
  } catch (error) {
    console.error("Erro ao conectar ao MongoDB:", error);
  }
}

await connectToDatabase(); // Aguarda a conexão antes de todos os testes

router.post("/", async function (req, res) {
  console.log("POST V1 REQ>BODY");
  console.log(req.body);
  const data = req.body;

  const webhookData = new WebhookData({
    resource: data.resource,
    type: data.type,
    data: data.data,
  });

  try {
    await webhookData.save();
    console.log("Dados salvos com sucesso no MongoDB!");
  } catch (error) {
    console.error("Erro ao salvar os dados:", error);
  }

  if (data.type === "payment") {
    const paymentData = data.data;
    const paymentId = paymentData.id;

    try {
      // Adicione um filtro para buscar o recurso correto
      const resourceData = await WebhookData.findOne({ 'data.id': paymentId, type: 'merchant_order' });
      if (!resourceData) {
        console.error("Nenhum recurso encontrado no banco de dados.");
        return res.status(404).send("Resource não encontrado");
      }
      const merchantOrderResource = resourceData.resource;
      console.log("Merchant Order Resource URL:", merchantOrderResource); // Adicione este log para verificar a URL
      const merchantOrderResponse = await axios.get(merchantOrderResource, {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      });
      const payments = merchantOrderResponse.data.payments || [];
      const approvedPayments = payments.filter(
        (payment) => payment.status === "approved"
      );

      if (approvedPayments.length > 0) {
        console.log("Pagamentos aprovados:", approvedPayments);
        await sendEmail(lastDeliveryData, lastItems, lastShipCoast);
        await WebhookData.deleteMany({});
        console.log("Todos os dados foram removidos do banco de dados.");
      } else {
        console.log("Nenhum pagamento aprovado.");
      }
    } catch (error) {
      if (error.response) {
        console.error(
          "Erro ao verificar o status do pagamento:",
          error.response.data
        );
      } else {
        console.error(
          "Erro ao verificar o status do pagamento:",
          error.message
        );
      }
    }
  }
  res.send("POST OK");
})
// Função para armazenar dados do pedido
export function setLastOrderData(deliveryData, items, shippingCost) {
  lastDeliveryData = deliveryData;
  lastItems = items;
  lastShipCoast = shippingCost;
}
export { connectToDatabase }; // Certifique-se de que está assim
export default router;
