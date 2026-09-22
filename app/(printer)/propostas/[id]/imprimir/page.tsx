import { notFound } from "next/navigation";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import PropostaPdfViewer from "@/components/pdf/proposta-pdf-viewer";
import type { CompanyPdfInfo, ProposalPdfData } from "@/components/pdf/PropostaPDF";
import { montarResumoEmpresaDocumentos } from "@/lib/configuracoes-documentos";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { deDecimal, paraMoeda } from "@/lib/dinheiro";

type ProposalPrintPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalPrintPage({ params }: ProposalPrintPageProps) {
  const { id } = await params;
  const contextoTenant = await exigirContextoTenant();

  const proposal = await contextoTenant.prisma.propostaComercial.findUnique({
    where: { id },
    include: {
      itens: {
        select: {
          id: true,
          descricao: true,
          quantidade: true,
          precoUnitario: true,
          subtotal: true,
        },
      },
    },
  });

  if (!proposal) {
    notFound();
  }

  const config = await obterConfiguracoes();
  const resumoEmpresa = montarResumoEmpresaDocumentos(config);

  const composedAddress = [config.logradouro, config.numero, config.bairro]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");

  const cityState = [config.cidade, config.estado]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" - ");

  const company: CompanyPdfInfo = {
    brandName: resumoEmpresa.nomeExibicao,
    legalName: config.razaoSocial?.trim() || resumoEmpresa.razaoSocial,
    cnpj: resumoEmpresa.cnpj !== "CNPJ não informado" ? resumoEmpresa.cnpj : undefined,
    stateRegistration: config.inscricaoEstadual?.trim()
      ? `Inscrição Estadual: ${config.inscricaoEstadual.trim()}`
      : undefined,
    address: config.endereco?.trim() || composedAddress || resumoEmpresa.endereco,
    cityState: cityState || resumoEmpresa.cidadeUf,
    contacts: resumoEmpresa.telefone !== "Telefone não informado" ? resumoEmpresa.telefone : undefined,
    logoUrl: resumoEmpresa.logoUrl || undefined,
  };

  const proposalData: ProposalPdfData = {
    id: proposal.id,
    cliente: proposal.cliente,
    aosCuidados: proposal.aosCuidados,
    dataEmissao: proposal.dataEmissao.toISOString(),
    validade: proposal.validade.toISOString(),
    equipamento: proposal.equipamento,
    defeito: proposal.defeito,
    introducao: proposal.introducao,
    subtotalBruto: paraMoeda(deDecimal(proposal.subtotalBruto)),
    descontoTotal: paraMoeda(deDecimal(proposal.descontoTotal)),
    valorTotal: paraMoeda(deDecimal(proposal.valorTotal)),
    condicoesPagamento: proposal.condicoesPagamento,
    termosGarantia: proposal.termosGarantia,
    itens: proposal.itens.map((item) => ({
      id: item.id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      precoUnitario: paraMoeda(deDecimal(item.precoUnitario)),
      subtotal: paraMoeda(deDecimal(item.subtotal)),
    })),
  };

  return <PropostaPdfViewer proposal={proposalData} company={company} />;
}
