// Limpeza pontual e temporaria: remove APENAS as linhas criadas pela primeira execucao do
// seed de demonstracao, que rodou antes do marcador "seed-demo-" existir. A identificacao e
// positiva (impressao digital), nunca por ausencia de marcador, para nao encostar em dados
// de teste criados a mao no tenant.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

if (String(process.env.AMBIENTE ?? "").toLowerCase() !== "teste") {
  console.error("ERRO: so roda com AMBIENTE=teste.");
  process.exit(1);
}

const confirmar = process.argv.includes("--confirm");
const naoMarcado = { NOT: { id: { startsWith: "seed-demo-" } } };

const DESCRICOES_DESPESA_LEGADO = [
  "Aluguel da loja", "Energia eletrica", "Internet e telefonia", "Honorarios contabeis",
  "Compra de bancada e mobiliario tecnico", "Estacao de solda e retrabalho BGA",
  "Notebook para o balcao de atendimento", "Reforma da fachada e comunicacao visual",
  "Microscopio trinocular para microsolda", "Ar-condicionado split da oficina",
  "Lote de pecas - telas Android", "Lote de pecas - baterias diversas",
  "Lote de conectores de carga", "Material de escritorio e embalagens",
  "Manutencao do sistema de cameras", "Anuncios patrocinados nas redes",
  "Uniformes da equipe", "Taxas e alvara municipal", "Ferramentas e insumos de bancada",
  "Lote de acessorios para revenda", "Servico de TI e backup em nuvem",
  "Treinamento tecnico em microsolda", "Reposicao de vitrine e expositores",
  "Frete de importacao de pecas",
];

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  log: ["error"],
});

const ids = (linhas) => linhas.map((l) => l.id);

// 1) Clientes de demonstracao (documentos sinteticos criados pelo seed).
const demoClientes = await prisma.cliente.findMany({
  where: { OR: [{ documento: { startsWith: "900" } }, { documento: { startsWith: "9000000000" } }] },
  select: { id: true, documento: true },
});
const demoClienteIds = ids(demoClientes);

// 2) OS legadas: sem marcador e apontando para um cliente de demonstracao.
const osLegado = await prisma.ordemServico.findMany({
  where: { AND: [naoMarcado, { clienteId: { in: demoClienteIds } }] },
  select: { id: true },
});
const osIds = ids(osLegado);

const termosLegado = await prisma.termoGarantiaOS.findMany({
  where: { AND: [naoMarcado, { osId: { in: osIds } }] },
  select: { id: true },
});
const termoIds = ids(termosLegado);

// 3) Vendas legadas: sem marcador e com a conta a receber caracteristica do seed.
const contasVendaLegado = await prisma.contaReceber.findMany({
  where: { AND: [naoMarcado, { descricao: "Venda PDV" }, { origem: "VENDA_PDV" }, { vendaId: { not: null } }] },
  select: { vendaId: true },
});
const vendaIds = [...new Set(contasVendaLegado.map((c) => c.vendaId))];

const vendasLegado = await prisma.venda.findMany({
  where: { AND: [naoMarcado, { id: { in: vendaIds } }] },
  select: { id: true, caixaSessionId: true },
});
const vendaIdsConfirmados = ids(vendasLegado);
const caixaIds = [...new Set(vendasLegado.map((v) => v.caixaSessionId).filter(Boolean))];

// 4) Despesas legadas: descricao exatamente igual a do catalogo antigo do seed.
const despesasLegado = await prisma.despesa.findMany({
  where: { AND: [naoMarcado, { descricao: { in: DESCRICOES_DESPESA_LEGADO } }] },
  select: { id: true },
});
const despesaIds = ids(despesasLegado);

const contasLegado = await prisma.contaReceber.findMany({
  where: {
    AND: [
      naoMarcado,
      {
        OR: [
          { ordemServicoId: { in: osIds } },
          { vendaId: { in: vendaIdsConfirmados } },
          {
            AND: [
              { ordemServicoId: null },
              { vendaId: null },
              { clienteId: { in: demoClienteIds } },
              { descricao: { in: ["Contrato de manutencao corporativa", "Servico avulso faturado"] } },
            ],
          },
        ],
      },
    ],
  },
  select: { id: true },
});

const contagens = {
  demoClientesPreservados: demoClienteIds.length,
  ordemServico: osIds.length,
  termoGarantiaOS: termoIds.length,
  venda: vendaIdsConfirmados.length,
  caixaSession: caixaIds.length,
  despesa: despesaIds.length,
  contaReceber: contasLegado.length,
  itemOS: await prisma.itemOS.count({ where: { AND: [naoMarcado, { osId: { in: osIds } }] } }),
  retornoGarantiaOS: await prisma.retornoGarantiaOS.count({ where: { AND: [naoMarcado, { termoGarantiaId: { in: termoIds } }] } }),
  itemVenda: await prisma.itemVenda.count({ where: { AND: [naoMarcado, { vendaId: { in: vendaIdsConfirmados } }] } }),
  vendaPagamento: await prisma.vendaPagamento.count({ where: { AND: [naoMarcado, { vendaId: { in: vendaIdsConfirmados } }] } }),
  parcelaDespesa: await prisma.parcelaDespesa.count({ where: { AND: [naoMarcado, { despesaId: { in: despesaIds } }] } }),
};

console.log(confirmar ? "CONFIRM: apagando linhas legadas identificadas" : "DRY-RUN: linhas legadas identificadas (nada apagado)");
console.log(JSON.stringify(contagens, null, 2));

if (confirmar) {
  const contaIds = ids(contasLegado);
  const resultado = await prisma.$transaction([
    prisma.ordemServico.updateMany({ where: { id: { in: osIds } }, data: { retornoGarantiaId: null } }),
    prisma.contaReceber.deleteMany({ where: { id: { in: contaIds } } }),
    prisma.vendaPagamento.deleteMany({ where: { AND: [naoMarcado, { vendaId: { in: vendaIdsConfirmados } }] } }),
    prisma.itemVenda.deleteMany({ where: { AND: [naoMarcado, { vendaId: { in: vendaIdsConfirmados } }] } }),
    prisma.venda.deleteMany({ where: { id: { in: vendaIdsConfirmados } } }),
    prisma.caixaSession.deleteMany({ where: { AND: [naoMarcado, { id: { in: caixaIds } }] } }),
    prisma.retornoGarantiaOS.deleteMany({ where: { AND: [naoMarcado, { termoGarantiaId: { in: termoIds } }] } }),
    prisma.itemOS.deleteMany({ where: { AND: [naoMarcado, { osId: { in: osIds } }] } }),
    prisma.termoGarantiaOS.deleteMany({ where: { id: { in: termoIds } } }),
    prisma.ordemServico.deleteMany({ where: { id: { in: osIds } } }),
    prisma.parcelaDespesa.deleteMany({ where: { AND: [naoMarcado, { despesaId: { in: despesaIds } }] } }),
    prisma.despesa.deleteMany({ where: { id: { in: despesaIds } } }),
  ]);
  console.log("Linhas afetadas por etapa:", resultado.map((r) => r.count));
}

await prisma.$disconnect();
