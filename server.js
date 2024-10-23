import express from "express";
import cors from "cors";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dotenv from "dotenv"; // Adicione esta linha
import axios from "axios"; // Importando o Axios
import nodemailer from "nodemailer";

dotenv.config(); // Carrega as variáveis de ambiente

// Configurando as credenciais do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

const app = express();
const port = 8080;
let lastDeliveryData = null;
let lastItems = [];
let lastShipCoast = 0;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send(`Olá, sou o servidor :)`);
});

// Endpoint para criar uma preferência de pagamento
app.post("/create_preference", async (req, res) => {
  try {
    console.log("Dados recebidos:", req.body);

    const { items, shippingCost, deliveryData } = req.body;
    lastDeliveryData = deliveryData;
    lastItems = items;
    lastShipCoast = shippingCost;

    const body = {
      items: items.map((item) => ({
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price), // Garantindo que o preço seja um número
        currency_id: "BRL", // Definindo a moeda como BRL
      })),
      back_urls: {
        success: "https://server-sbgallery.onrender.com/feedback", // Atualize com seu URL de sucesso
        failure: "https://sb-gallery.vercel.app/error", // Atualize com seu URL de falha
        pending: "https://sb-gallery.vercel.app/error", // Atualize com seu URL de pendente
      },
      auto_return: "approved",
      transaction_amount: items.reduce(
        (total, item) => total + item.unit_price * item.quantity,
        0
      ), // Total da transação
      shipments: {
        mode: "not_specified",
        receiver_address: {
          id: "1", // Adicione um ID fictício ou use um gerador de IDs
          address_line: `${deliveryData.endereco}, ${deliveryData.numero}`, // Corrigido
          street_name: deliveryData.endereco,
          street_number: deliveryData.numero,
          zip_code: deliveryData.cep,
          city: {
            name: deliveryData.cidade, // Deve ser um objeto com a propriedade name
          },
          state: {
            id: "MS", // Use o ID apropriado para o estado
            name: deliveryData.estado,
          },
          country: {
            id: "BR", // ID do Brasil
            name: "Brasil",
          },
          latitude: "0.0", // Adicione valores fictícios se necessário
          longitude: "0.0",
          comment: "Comentário fictício", // Comentário opcional
          contact: deliveryData.nome, // Contato do destinatário
          phone: deliveryData.telefone, // Telefone do destinatário
        },
      },
    };

    console.log("Preference Body:", body);

    const preference = new Preference(client);
    const result = await preference.create({ body });
    console.log("Resultado da criação da preferência:", result);
    res.json({
      id: result.id,
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
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`, // Use seu token
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
app.get("/feedback", async (req, res) => {
  const { payment_id, status, merchant_order_id } = req.query;

  if (status === "approved") {
    // Verifique se lastDeliveryData e lastItems estão definidos
    if (!lastDeliveryData || !lastItems) {
      console.error("Dados de entrega ou itens não encontrados.");
      return res
        .status(400)
        .json({ error: "Dados de entrega ou itens não encontrados." });
    }

    const deliveryData = lastDeliveryData;
    const shippingCost = lastShipCoast;

    // Formatar a mensagem com os itens comprados
    const itemsDetails = lastItems
      .map((item) => {
        return `Produto: ${item.title}\nQuantidade: ${
          item.quantity
        }\nPreço: R$ ${item.unit_price.toFixed(2)}`;
      })
      .join("\n\n"); // Adiciona uma quebra de linha entre os itens

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "sbgallerybrazil@gmail.com", // Seu e-mail
      subject: "Novo Pedido Aprovado",
      text: `Dados do Endereço:
      Nome: ${deliveryData.nome}
      Endereço: ${deliveryData.endereco}, ${deliveryData.numero}
      Cidade: ${deliveryData.cidade}
      Estado: ${deliveryData.estado}
      CEP: ${deliveryData.cep}
      Telefone: ${deliveryData.telefone}

      Itens Comprados:
      ${itemsDetails}

      Valor do Frete: R$ ${shippingCost.toFixed(2)}`,
    };

    try {
      // Enviar e-mail
      await transporter.sendMail(mailOptions);
      console.log("E-mail enviado com sucesso!");

      // Redireciona para a página após o envio do e-mail
      return res.redirect("https://sb-gallery.vercel.app/home");
    } catch (error) {
      console.error("Erro ao enviar o e-mail:", error);
      // Opcional: Redirecionar mesmo em caso de erro no envio do e-mail
      return res.redirect("https://sb-gallery.vercel.app/error");
    }
  }

  // Redireciona em caso de status diferente de "approved"
  return res.redirect("https://sb-gallery.vercel.app/home");
});

const transporter = nodemailer.createTransport({
  service: "gmail", // ou outro serviço de e-mail que você estiver usando
  auth: {
    user: process.env.EMAIL_USER, // seu e-mail
    pass: process.env.EMAIL_PASS, // sua senha ou app password
  },
});

// Iniciando o servidor na porta 8080
app.listen(port, () => {
  console.log(`O servidor está rodando na porta ${port}`);
});
