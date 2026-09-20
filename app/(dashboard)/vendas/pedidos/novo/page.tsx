import { NewSalesOrderWizard } from "@/components/vendas/new-sales-order-wizard";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { ID_CLIENTE_CONSUMIDOR_FINAL } from "@/lib/dominio/crm/consumidor-final";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = {
  title: "Novo Pedido de Venda - Konext ERP",
  description: "Layout estático para criação de pedido de venda.",
};

export default async function NewSalesOrderPage({ searchParams }: PageProps) {
  const { prisma } = await exigirContextoTenant();
  const params = await searchParams;
  const proposalId = getSingleParam(params, "propostaId")?.trim();

  const [crmClients, stockProducts] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        papel: "CLIENTE",
        id: { not: ID_CLIENTE_CONSUMIDOR_FINAL },
      },
      orderBy: {
        nomeRazaoSocial: "asc",
      },
      select: {
        id: true,
        nomeRazaoSocial: true,
        nomeFantasia: true,
      },
    }),
    prisma.produto.findMany({
      where: {
        ativo: true,
      },
      orderBy: {
        nome: "asc",
      },
      select: {
        id: true,
        nome: true,
        precoVenda: true,
      },
    }),
  ]);

  const proposalData = proposalId
    ? await prisma.propostaComercial.findUnique({
        where: {
          id: proposalId,
        },
        include: {
          itens: {
            select: {
              descricao: true,
              quantidade: true,
              precoUnitario: true,
              descontoPercentual: true,
            },
          },
        },
      })
    : null;

  const clientOptions = crmClients.map((client) => ({
    id: client.id,
    name: client.nomeFantasia?.trim() || client.nomeRazaoSocial,
  }));

  const productOptions = stockProducts.map((product) => ({
    id: product.id,
    name: product.nome,
    price: product.precoVenda,
  }));

  const initialData = proposalData
    ? {
        proposalId: proposalData.id,
        clientName: proposalData.cliente,
        paymentConditions: proposalData.condicoesPagamento,
        items: proposalData.itens,
      }
    : null;

  return (
    <NewSalesOrderWizard
      clientOptions={clientOptions}
      productOptions={productOptions}
      initialData={initialData}
    />
  );
}
