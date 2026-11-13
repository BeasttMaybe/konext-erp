import { assinanteDaOS, type AssinaturaDoDocumento } from "@/lib/dominio/usuarios/assinatura";
import { assinaturaDoDocumento } from "@/lib/usuarios/assinaturas";
import type { ModeloImpressaoOS } from "@prisma/client";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { montarResumoEmpresaDocumentos, type ResumoEmpresaDocumentos } from "@/lib/configuracoes-documentos";

type OrdemServicoImpressao = {
  status: string;
  numeroOs?: number | null;
  criadoEm: Date | string;
  cliente?: { nomeRazaoSocial?: string | null; documento?: string | null; telefone?: string | null } | null;
  equipamento?: string | null;
  marca?: string | null;
  modelo?: string | null;
  imei?: string | null;
  senha?: string | null;
  relatoCliente?: string | null;
  condicaoFisica?: string | null;
  acessorios?: string | null;
  senhaDesenho?: string | null;
  itens?: Array<{ id: string; descricao?: string | null; tipoPeca?: string | null; valorCobrado?: number | null }>;
  termoGarantia?: {
    prazoGarantiaDias: number;
    dataFimGarantia: Date | string;
    canceladaEm: Date | string | null;
  } | null;
  tecnicos?: Array<{ principal: boolean; usuario: { id: string; nome: string } }>;
  criadoPor?: { id: string; nome: string } | null;
};

type OrdemServicoImpressaoDelegate = {
  findUnique?: (args: unknown) => Promise<OrdemServicoImpressao | null>;
  findFirst?: (args: unknown) => Promise<OrdemServicoImpressao | null>;
};

const mapaStatusLabel: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "Aguardando Orçamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  APROVADO: "Aprovado",
  AGUARDANDO_PECA: "Aguardando Peça",
  EM_MANUTENCAO: "Em Manutenção",
  GARANTIA_RETORNO: "Garantia / Retorno",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

function extrairNumeroOsDoSlug(entrada: string): number | null {
  const slug = entrada.trim().toLowerCase();
  const match = slug.match(/^os-(\d+)$|^os-\d{4}-(\d+)$/);
  const numeroTexto = match?.[1] ?? match?.[2];
  if (!numeroTexto) return null;
  const numero = Number(numeroTexto);
  return Number.isFinite(numero) ? numero : null;
}

export const formatarMoedaImpressao = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export type ItemImpressaoOS = {
  id: string;
  descricao: string;
  tipoPeca: string;
  valorCobrado: number;
};

export type GarantiaImpressaoOS = {
  prazoDias: number;
  dataFim: string | null;
  origem: "OS" | "PADRAO";
};

export type DadosImpressaoOS = {
  numeroOs: string;
  statusLabel: string;
  dataEmissao: string;
  nomeCliente: string;
  documentoCliente: string;
  telefoneCliente: string;
  equipamento: string;
  marca: string;
  modelo: string;
  imei: string;
  /** A senha e o desenho NAO saem no papel (vai para o cliente): so se foram informados. */
  senhaInformada: boolean;
  desenhoInformado: boolean;
  relatoCliente: string;
  condicaoFisica: string;
  acessorios: string;
  itens: ItemImpressaoOS[];
  totalOS: number;
  empresa: ResumoEmpresaDocumentos;
  razaoSocialDistinta: string | null;
  garantia: GarantiaImpressaoOS | null;
  imprimirLogoTermica: boolean;
  mensagemRodapeImpressaoOS: string;
  modeloImpressaoOSPadrao: ModeloImpressaoOS;
  /** Quem assina pela loja (tecnico principal) e a assinatura dele, se tiver. */
  assinaturaTecnico: AssinaturaDoDocumento | null;
};

export async function obterDadosImpressaoOS(id: string): Promise<DadosImpressaoOS | null> {
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoImpressaoDelegate;
    OrdemServico?: OrdemServicoImpressaoDelegate;
  };
  const delegateOrdemServico = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!delegateOrdemServico?.findUnique) {
    throw new Error("Delegate Prisma de OrdemServico não disponível.");
  }

  const includeQuery = {
    cliente: { select: { nomeRazaoSocial: true, documento: true, telefone: true } },
    itens: true,
    termoGarantia: { select: { prazoGarantiaDias: true, dataFimGarantia: true, canceladaEm: true } },
    tecnicos: { select: { principal: true, usuario: { select: { id: true, nome: true } } }, orderBy: { criadoEm: "asc" } },
    criadoPor: { select: { id: true, nome: true } },
  };

  const [osRaw, config] = await Promise.all([
    delegateOrdemServico.findUnique({ where: { id }, include: includeQuery }),
    obterConfiguracoes(),
  ]);

  let os = osRaw;

  if (!os) {
    const slug = extrairNumeroOsDoSlug(id);
    if (slug !== null && delegateOrdemServico.findFirst) {
      os = await delegateOrdemServico.findFirst({
        where: { numeroOs: slug },
        include: includeQuery,
      });
    }
  }

  if (!os) {
    return null;
  }

  const empresa = montarResumoEmpresaDocumentos(config);
  const razaoSocialTrim = config.razaoSocial?.trim() ?? "";
  const razaoSocialDistinta =
    razaoSocialTrim && razaoSocialTrim !== empresa.nomeExibicao ? razaoSocialTrim : null;

  const itens: ItemImpressaoOS[] = (os.itens ?? []).map((item) => ({
    id: String(item.id),
    descricao: String(item.descricao ?? ""),
    tipoPeca: String(item.tipoPeca ?? "OUTROS").replaceAll("_", " ").toLowerCase(),
    valorCobrado: Number(item.valorCobrado ?? 0),
  }));

  const totalOS = itens.reduce((acc, item) => acc + item.valorCobrado, 0);

  const termo = os.termoGarantia;
  const garantia: GarantiaImpressaoOS | null = termo
    ? termo.canceladaEm
      ? null
      : {
          prazoDias: termo.prazoGarantiaDias,
          dataFim: new Date(termo.dataFimGarantia).toLocaleDateString("pt-BR"),
          origem: "OS",
        }
    : {
        prazoDias: config.prazoGarantiaPadraoDias,
        dataFim: null,
        origem: "PADRAO",
      };

  const assinaturaTecnico = await assinaturaDoDocumento(
    prisma,
    assinanteDaOS({ tecnicos: os.tecnicos ?? [], criadoPor: os.criadoPor ?? null })
  );

  return {
    numeroOs: String(os.numeroOs ?? "-"),
    statusLabel: mapaStatusLabel[String(os.status)] ?? String(os.status).replaceAll("_", " "),
    dataEmissao: new Date(os.criadoEm).toLocaleDateString("pt-BR"),
    nomeCliente: String(os.cliente?.nomeRazaoSocial ?? "Não informado"),
    documentoCliente: String(os.cliente?.documento ?? "Não informado"),
    telefoneCliente: String(os.cliente?.telefone ?? "Não informado"),
    equipamento: String(os.equipamento ?? "Não informado"),
    marca: String(os.marca ?? "Não informado"),
    modelo: String(os.modelo ?? "Não informado"),
    imei: String(os.imei ?? "Não informado"),
    senhaInformada: Boolean(os.senha),
    desenhoInformado: Boolean(os.senhaDesenho),
    relatoCliente: String(os.relatoCliente ?? "Não informado"),
    condicaoFisica: String(os.condicaoFisica ?? "Não informada"),
    acessorios: String(os.acessorios ?? "Não informado"),
    itens,
    totalOS,
    empresa,
    razaoSocialDistinta,
    garantia,
    imprimirLogoTermica: config.imprimirLogoTermica,
    mensagemRodapeImpressaoOS: config.mensagemRodapeImpressaoOS,
    modeloImpressaoOSPadrao: config.modeloImpressaoOSPadrao,
    assinaturaTecnico,
  };
}
