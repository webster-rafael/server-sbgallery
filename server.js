import express from "express";
import cors from "cors";
import { MercadoPagoConfig, Preference } from "mercadopago";

// Configurando as credenciais do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken:
    "APP_USR-566102297275382-101310-c7a1d3546948113f7ec07a10e33893c9-2032928969", // Atualize com seu token
});

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send(`Olá, sou o servidor :)`);
});

// Endpoint para criar uma preferência de pagamento
app.post("/create_preference", async (req, res) => {
  try {
    console.log("Dados recebidos:", req.body);

    const { items, total_amount } = req.body;

    const body = {
      items: items.map((item) => ({
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price), // Garantindo que o preço seja um número
        currency_id: "BRL", // Definindo a moeda como BRL
      })),
      back_urls: {
        success: "http://localhost:8080/feedback", // Atualize com seu URL de sucesso
        failure: "http://localhost:8080/feedback", // Atualize com seu URL de falha
        pending: "http://localhost:8080/feedback", // Atualize com seu URL de pendente
      },
      auto_return: "approved",
      transaction_amount: items.reduce(
        (total, item) => total + item.unit_price * item.quantity,
        0
      ), // Total da transação

      shipments: {
        cost: 40, // Valor do frete em centavos (R$ 40,00)
        mode: "not_specified",
      },
      address: {
        street_name: "Rua Exemplo",
        street_number: "123",
        zip_code: "12345678",
        state: "SP",
        city: "São Paulo",
      },
    };

    console.log("Preference Body:", body);

    const preference = new Preference(client);
    const result = await preference.create({ body });
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

// Endpoint de feedback após o pagamento
app.get("/feedback", (req, res) => {
  res.json({
    Payment: req.query.payment_id,
    Status: req.query.status,
    MerchantOrder: req.query.merchant_order_id,
  });
});

// Iniciando o servidor na porta 8080
app.listen(port, () => {
  console.log(`O servidor está rodando na porta ${port}`);
});
