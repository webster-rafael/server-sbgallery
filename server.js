import express from "express";
import cors from "cors";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import webhookRouter, { setLastOrderData } from "./webhook.js";

dotenv.config();

// Configurando as credenciais do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

const app = express();
const port = 8080;

let lastDeliveryData = null;
let lastItems = [];
let lastShipCoast = 0;
let paymentStatus = null; // Armazena o status do pagamento
let paymentId = null; // Armazena o ID do pagamento

app.use(cors());
app.use(express.json());
app.use("/v1/webhook", webhookRouter);

app.get("/", (req, res) => {
  res.send(`Olá, sou o servidor :)`);
});

// Endpoint para criar uma preferência de pagamento
app.post("/create_preference", async (req, res) => {
  try {
    console.log("Dados recebidos:", req.body);

    const { items, shippingCost, deliveryData, totalAmount } = req.body;
    setLastOrderData(deliveryData, items, shippingCost);
    lastDeliveryData = deliveryData;
    lastItems = items;
    lastShipCoast = shippingCost;

    const body = {
      items: items.map((item) => ({
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        currency_id: "BRL",
      })),
      back_urls: {
        success: "https://sb-gallery.vercel.app/compraConcluida",
        failure: "https://sb-gallery.vercel.app/error",
        pending: "https://sb-gallery.vercel.app/error",
      },
      auto_return: "all",
      transaction_amount: totalAmount,
      shipments: {
        cost: 1,
        mode: "not_specified",
        receiver_address: {
          id: "1",
          address_line: `${deliveryData.endereco}, ${deliveryData.numero}`,
          street_name: deliveryData.endereco,
          street_number: deliveryData.numero,
          zip_code: deliveryData.cep,
          city: {
            name: deliveryData.cidade,
          },
          state: {
            id: "MS",
            name: deliveryData.estado,
          },
          country: {
            id: "BR",
            name: "Brasil",
          },
          latitude: "0.0",
          longitude: "0.0",
          comment: "Comentário fictício",
          contact: deliveryData.nome,
          phone: deliveryData.telefone,
        },
      },
      notification_url: "https://server-sbgallery.vercel.app/v1/webhook",
      customization: {
        visual: {
          showExternalReference: true, // Define se a referência externa deve ser mostrada
        },
      },
    };

    console.log("Preference Body:", body);

    const preference = new Preference(client);
    const result = await preference.create({ body });
    paymentId = result.id; // Armazena o ID da preferência
    console.log("Resultado da criação da preferência:", result);
    res.json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Erro ao criar a preferência",
    });
  }
});

// Rota para buscar dados do pedido
app.get("/order/:id", async (req, res) => {
  const orderId = req.params.id;

  try {
    const response = await axios.get(
      `https://api.mercadopago.com/merchant_orders/${orderId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Erro ao buscar o pedido:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Erro ao buscar o pedido",
      details: error.message,
    });
  }
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Função para enviar o e-mail
export async function sendEmail() {
  const deliveryData = lastDeliveryData;
  const shippingCost = lastShipCoast;

  const itemsDetails = lastItems
    .map((item) => {
      return `Produto: ${item.title}\nQuantidade: ${
        item.quantity
      }\nPreço: R$ ${item.unit_price.toFixed(2)}`;
    })
    .join("\n\n");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: `${deliveryData.email}, ${process.env.EMAIL_USER}`,
    subject: "Novo Pedido Aprovado",
    text: `Dados do Endereço:
    Nome: ${deliveryData.nome}
    Endereço: ${deliveryData.endereco}, ${deliveryData.numero}
    Cidade: ${deliveryData.cidade}
    Estado: ${deliveryData.estado}
    CEP: ${deliveryData.cep}
    Telefone: ${deliveryData.telefone}
    E-mail: ${deliveryData.email}

    Itens Comprados:
    ${itemsDetails}

    Valor do Frete: R$ ${shippingCost.toFixed(2)}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("E-mail enviado com sucesso!");
  } catch (error) {
    console.error("Erro ao enviar o e-mail:", error);
  }
}

// Iniciando o servidor na porta 8080
app.listen(port, () => {
  console.log(`O servidor está rodando na porta ${port}`);
});
