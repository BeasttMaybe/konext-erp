// Ponte WebSocket -> TCP para o driver serverless do Neon falar com um
// Postgres comum, local. So para teste neste sandbox.
const path = require("node:path");
const net = require("node:net");
const { WebSocketServer } = require(path.join(process.argv[2], "node_modules/ws"));

const servidor = new WebSocketServer({ port: 5488 });
servidor.on("connection", (ws, req) => {
  const endereco = new URL(req.url, "http://x").searchParams.get("address") || "127.0.0.1:5433";
  const [, porta] = endereco.split(":");
  const tcp = net.connect(Number(porta) || 5433, "127.0.0.1");
  tcp.on("data", (dados) => ws.readyState === 1 && ws.send(dados));
  ws.on("message", (dados) => tcp.write(dados));
  ws.on("close", () => tcp.destroy());
  ws.on("error", () => tcp.destroy());
  tcp.on("close", () => ws.close());
  tcp.on("error", () => ws.close());
});
console.log("ponte ws pronta na 5488");
