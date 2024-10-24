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

connectToDatabase();

router.post("/", async function (req, res) {
  console.log("POST V1 REQ>BODY");
  console.log(req.body);

  const data = req.body;

  // Cria um novo documento no banco de dados
  const webhookData = new WebhookData({
    resource: data.resource,
    type: data.type,
    data: data.data,
  });

  try {
    await webhookData.save(); // Salva o documento no MongoDB
    console.log("Dados salvos com sucesso no MongoDB!");
  } catch (error) {
    console.error("Erro ao salvar os dados:", error);
  }

  // Verifica se o tipo é um pagamento
  if (data.type === "payment") {
    const paymentData = data.data; // Dados do pagamento
    const paymentId = paymentData.id; // ID do pagamento

    try {
      // Busca o recurso no MongoDB
      const resourceData = await WebhookData.findOne({}); // Aqui você pode adicionar filtros se necessário
      if (!resourceData) {
        console.error("Nenhum recurso encontrado no banco de dados.");
        return res.status(404).send("Resource não encontrado");
      }

      const merchantOrderResource = resourceData.resource;

      // Faz a requisição para o merchant order
      const merchantOrderResponse = await axios.get(merchantOrderResource, {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      });

      // Obtém os pagamentos associados ao pedido
      const payments = merchantOrderResponse.data.payments || [];

      // Verifica se algum pagamento está aprovado
      const approvedPayments = payments.filter(
        (payment) => payment.status === "approved"
      );

      if (approvedPayments.length > 0) {
        console.log("Pagamentos aprovados:", approvedPayments);

        // Envia o e-mail com os dados do pedido
        await sendEmail(lastDeliveryData, lastItems, lastShipCoast);

        // Limpa o banco de dados após o envio do e-mail
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
        console.error("Erro ao verificar o status do pagamento:", error.message);
      }
    }
  }

  res.send("POST OK");
});

// Função para armazenar dados do pedido
export function setLastOrderData(deliveryData, items, shippingCost) {
  lastDeliveryData = deliveryData;
  lastItems = items;
  lastShipCoast = shippingCost;
}

export default router;
