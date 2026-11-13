import { OrdemServicoForm, type OrdemServicoFormInitialData } from "@/components/os/ordem-servico-form";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { deDecimal, paraMoeda } from "@/lib/dinheiro";

interface OSNewPageProps {
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
  title: "Nova Ordem de Serviço - TechOS ERP",
  description: "Criação de ordem de serviço com suporte a pré-preenchimento por proposta.",
};

export default async function OSNewPage({ searchParams }: OSNewPageProps) {
  const params = await searchParams;
  const proposalId = getSingleParam(params, "propostaId")?.trim();
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;

  const proposal = proposalId
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
              subtotal: true,
            },
          },
        },
      })
    : null;

  const initialData: OrdemServicoFormInitialData | null = proposal
    ? {
        proposalId: proposal.id,
        clientName: proposal.cliente,
        equipment: proposal.equipamento,
        reportedDefect: proposal.defeito,
        items: proposal.itens.map((item) => ({
          ...item,
          precoUnitario: paraMoeda(deDecimal(item.precoUnitario)),
          subtotal: paraMoeda(deDecimal(item.subtotal)),
          descontoPercentual: Number(item.descontoPercentual),
        })),
      }
    : null;

  return <OrdemServicoForm initialData={initialData} />;
}
