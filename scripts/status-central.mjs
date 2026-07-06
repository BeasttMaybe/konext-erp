import "dotenv/config";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.CENTRAL_DATABASE_URL;

if (!connectionString) {
  console.error("CENTRAL_DATABASE_URL nao definida.");
  process.exit(1);
}

const prismaCentral = new PrismaCentral({
  adapter: new PrismaNeon({ connectionString }),
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

async function executar() {
  const [empresas, tenants, usuariosCentrais, vinculos, listaTenants] = await Promise.all([
    prismaCentral.empresa.count(),
    prismaCentral.tenant.count(),
    prismaCentral.usuarioCentral.count(),
    prismaCentral.usuarioEmpresa.count(),
    prismaCentral.tenant.findMany({
      select: {
        slug: true,
        status: true,
        versaoSchema: true,
        connectionRef: true,
      },
      orderBy: {
        slug: "asc",
      },
    }),
  ]);

  console.log(JSON.stringify({
    empresas,
    tenants,
    usuariosCentrais,
    vinculosUsuarioEmpresa: vinculos,
    listaTenants,
  }, null, 2));
}

executar()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : "Falha desconhecida ao consultar status central.");
    process.exit(1);
  })
  .finally(async () => {
    await prismaCentral.$disconnect();
  });
