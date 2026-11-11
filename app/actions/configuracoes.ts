"use server";

import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";

import { revalidatePath } from "next/cache";
import type { ModeloImpressaoOS, Prisma } from "@prisma/client";
import { z } from "zod";
import { consultarCnpjReceitaCliente } from "@/app/actions/crm";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { SELECAO_DE_CONFIGURACAO, SELECAO_SO_O_ID } from "@/lib/configuracoes/campos-lidos";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { paraMensagemSegura } from "@/lib/erros";
import type { ContextoTenantServidor } from "@/types/tenant";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import {
  normalizarConfiguracaoPdv,
  obterDefaultsConfiguracaoPdv,
  possuiFormaPagamentoHabilitada,
} from "@/lib/configuracoes-pdv";
import {
  obterDefaultsConfiguracaoOsGarantias,
  TEXTO_COBERTURA_GARANTIA_PADRAO,
  TEXTO_EXCLUSOES_GARANTIA_PADRAO,
  TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
} from "@/lib/configuracoes-os-garantias";

type ConfiguracaoRegistro = {
  id: string;
  // `criadoEm` e `atualizadoEm` nao estao aqui de proposito: a linha e lida
  // por SELECAO_DE_CONFIGURACAO, que so pede o que o codigo usa, e ninguem
  // le essas duas (so se ORDENA por `criadoEm`, o que nao exige traze-la).
  // Declara-las faria o tipo prometer campos que a consulta nao devolve.
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
  mensagemCupom?: string | null;
  modeloImpressaoOSPadrao?: ModeloImpressaoOS | null;
  imprimirLogoTermica?: boolean | null;
  mensagemRodapeImpressaoOS?: string | null;
  permitirVendaSemEstoque?: boolean | null;
  fechamentoAutomaticoCaixaAtivo?: boolean | null;
  fechamentoAutomaticoCaixaHorario?: string | null;
  permitirPagamentoMisto?: boolean | null;
  permitirDescontoPDV?: boolean | null;
  descontoMaximoPDVPercentual?: number | Prisma.Decimal | null;
  permitirVendaFiado?: boolean | null;
  habilitarPix?: boolean | null;
  habilitarDinheiro?: boolean | null;
  habilitarCartaoDebito?: boolean | null;
  habilitarCartaoCredito?: boolean | null;
  habilitarBoleto?: boolean | null;
  habilitarCrediario?: boolean | null;
  taxaCartaoDebitoPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito1xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito2xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito3xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito4xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito5xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito6xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito7xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito8xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito9xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito10xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito11xPercentual?: number | Prisma.Decimal | null;
  taxaCartaoCredito12xPercentual?: number | Prisma.Decimal | null;
  prazoPadraoBoletoDias?: number | null;
  prazoPadraoCrediarioDias?: number | null;
  maxParcelasCartaoCredito?: number | null;
  logoUrl?: string | null;
  prazoGarantiaPadraoDias?: number | null;
  prazoMinimoGarantiaDias?: number | null;
  prazoMaximoGarantiaDias?: number | null;
  exigirGarantiaAntesEntrega?: boolean | null;
  exigirItemParaGarantia?: boolean | null;
  exigirItemParaEnviarPDV?: boolean | null;
  exigirDiagnosticoParaFinalizar?: boolean | null;
  custoPecaOSJaPago?: boolean | null;
  permitirFinalizarSemPagamento?: boolean | null;
  permitirGarantiaPersonalizada?: boolean | null;
  textoCoberturaGarantia?: string | null;
  textoExclusoesGarantia?: string | null;
  textoResponsabilidadeDados?: string | null;
};

type UsuarioConfiguracaoRegistro = {
  id: string;
  nome: string;
  email: string;
  senha?: string;
  role: string;
  criadoEm?: Date;
  fotoPerfilUrl?: string | null;
};

type ConfiguracaoDelegate = {
  findFirst?: (args: unknown) => Promise<ConfiguracaoRegistro | null>;
  findUnique?: (args: unknown) => Promise<ConfiguracaoRegistro | null>;
  create?: (args: unknown) => Promise<ConfiguracaoRegistro>;
  update?: (args: unknown) => Promise<ConfiguracaoRegistro>;
};

type UsuarioDelegate = {
  findFirst?: (args: unknown) => Promise<UsuarioConfiguracaoRegistro | null>;
  findUnique?: (args: unknown) => Promise<UsuarioConfiguracaoRegistro | null>;
  upsert?: (args: unknown) => Promise<UsuarioConfiguracaoRegistro>;
  create?: (args: unknown) => Promise<UsuarioConfiguracaoRegistro>;
  update?: (args: unknown) => Promise<UsuarioConfiguracaoRegistro>;
};

type PrismaOperacionalTenant = ContextoTenantServidor["prisma"];

type PrismaConfiguracoesClient = PrismaOperacionalTenant & {
  configuracao?: ConfiguracaoDelegate;
  Configuracao?: ConfiguracaoDelegate;
  usuario?: UsuarioDelegate;
  Usuario?: UsuarioDelegate;
};

export type DadosPerfil = {
  nome?: string;
  email?: string;
  fotoPerfilUrl?: string;
};

export type DadosConfiguracoes = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  endereco: string;
  mensagemCupom: string;
  modeloImpressaoOSPadrao: ModeloImpressaoOS;
  imprimirLogoTermica: boolean;
  mensagemRodapeImpressaoOS: string;
  permitirVendaSemEstoque: boolean;
  fechamentoAutomaticoCaixaAtivo: boolean;
  fechamentoAutomaticoCaixaHorario: string;
  permitirPagamentoMisto: boolean;
  permitirDescontoPDV: boolean;
  descontoMaximoPDVPercentual: number;
  permitirVendaFiado: boolean;
  habilitarPix: boolean;
  habilitarDinheiro: boolean;
  habilitarCartaoDebito: boolean;
  habilitarCartaoCredito: boolean;
  habilitarBoleto: boolean;
  habilitarCrediario: boolean;
  taxaCartaoDebitoPercentual: number;
  taxaCartaoCredito1xPercentual: number;
  taxaCartaoCredito2xPercentual: number;
  taxaCartaoCredito3xPercentual: number;
  taxaCartaoCredito4xPercentual: number;
  taxaCartaoCredito5xPercentual: number;
  taxaCartaoCredito6xPercentual: number;
  taxaCartaoCredito7xPercentual: number;
  taxaCartaoCredito8xPercentual: number;
  taxaCartaoCredito9xPercentual: number;
  taxaCartaoCredito10xPercentual: number;
  taxaCartaoCredito11xPercentual: number;
  taxaCartaoCredito12xPercentual: number;
  prazoPadraoBoletoDias: number;
  prazoPadraoCrediarioDias: number;
  maxParcelasCartaoCredito: number;
  logoUrl: string;
  prazoGarantiaPadraoDias: number;
  prazoMinimoGarantiaDias: number;
  prazoMaximoGarantiaDias: number;
  exigirGarantiaAntesEntrega: boolean;
  exigirItemParaGarantia: boolean;
  exigirItemParaEnviarPDV: boolean;
  exigirDiagnosticoParaFinalizar: boolean;
  custoPecaOSJaPago: boolean;
  permitirFinalizarSemPagamento: boolean;
  permitirGarantiaPersonalizada: boolean;
  textoCoberturaGarantia: string;
  textoExclusoesGarantia: string;
  textoResponsabilidadeDados: string;
};

export type ResultadoConsultaCnpj =
  | {
      sucesso: true;
      dados: {
        razaoSocial: string;
        nomeFantasia: string;
        cnpj: string;
        inscricaoEstadual: string;
        telefone: string;
        cep: string;
        logradouro: string;
        numero: string;
        bairro: string;
        cidade: string;
        estado: string;
      };
    }
  | {
      sucesso: false;
      erro: string;
    };

type ResultadoAcaoPerfil =
  | {
      sucesso: true;
      id: string;
    }
  | {
      sucesso: false;
      erro: string;
    };

const schemaDadosConfiguracoes = z.object({
  razaoSocial: z.string().trim().max(160, "Razão social excede o limite de 160 caracteres."),
  nomeFantasia: z.string().trim().max(120, "Nome fantasia excede o limite de 120 caracteres."),
  cnpj: z
    .string()
    .trim()
    .max(18, "CNPJ excede o limite de 18 caracteres.")
    .refine((valor) => {
      const digitos = valor.replace(/\D/g, "");
      return digitos.length === 0 || digitos.length === 14;
    }, "CNPJ inválido."),
  inscricaoEstadual: z.string().trim().max(40, "Inscrição estadual excede o limite de 40 caracteres."),
  telefone: z.string().trim().max(20, "Telefone excede o limite de 20 caracteres."),
  cep: z
    .string()
    .trim()
    .max(9, "CEP excede o limite de 9 caracteres.")
    .refine((valor) => {
      const digitos = valor.replace(/\D/g, "");
      return digitos.length === 0 || digitos.length === 8;
    }, "CEP inválido."),
  logradouro: z.string().trim().max(160, "Logradouro excede o limite de 160 caracteres."),
  numero: z.string().trim().max(30, "Número excede o limite de 30 caracteres."),
  bairro: z.string().trim().max(120, "Bairro excede o limite de 120 caracteres."),
  cidade: z.string().trim().max(120, "Cidade excede o limite de 120 caracteres."),
  estado: z.string().trim().max(2, "UF deve ter no máximo 2 caracteres."),
  endereco: z.string().trim().max(255, "Endereço completo excede o limite de 255 caracteres."),
  mensagemCupom: z.string().trim().max(1000, "Mensagem do cupom excede o limite de 1000 caracteres."),
  modeloImpressaoOSPadrao: z.enum(["A4", "TERMICA_80MM"]),
  imprimirLogoTermica: z.boolean(),
  mensagemRodapeImpressaoOS: z.string().trim().max(300, "Mensagem de rodapé excede o limite de 300 caracteres."),
  permitirVendaSemEstoque: z.boolean(),
  fechamentoAutomaticoCaixaAtivo: z.boolean(),
  fechamentoAutomaticoCaixaHorario: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido, no formato HH:mm."),
  permitirPagamentoMisto: z.boolean(),
  permitirDescontoPDV: z.boolean(),
  descontoMaximoPDVPercentual: z.coerce
    .number()
    .min(0, "O desconto máximo deve estar entre 0% e 100%.")
    .max(100, "O desconto máximo deve estar entre 0% e 100%."),
  permitirVendaFiado: z.boolean(),
  habilitarPix: z.boolean(),
  habilitarDinheiro: z.boolean(),
  habilitarCartaoDebito: z.boolean(),
  habilitarCartaoCredito: z.boolean(),
  habilitarBoleto: z.boolean(),
  habilitarCrediario: z.boolean(),
  taxaCartaoDebitoPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito1xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito2xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito3xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito4xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito5xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito6xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito7xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito8xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito9xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito10xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito11xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  taxaCartaoCredito12xPercentual: z.coerce.number().min(0, "As taxas não podem ser negativas."),
  prazoPadraoBoletoDias: z.coerce.number().int().min(1, "Prazo de boleto deve ser entre 1 e 365 dias.").max(365, "Prazo de boleto deve ser entre 1 e 365 dias."),
  prazoPadraoCrediarioDias: z.coerce.number().int().min(1, "Prazo de crediário deve ser entre 1 e 365 dias.").max(365, "Prazo de crediário deve ser entre 1 e 365 dias."),
  maxParcelasCartaoCredito: z.coerce.number().int().min(1, "Máximo de parcelas deve ser entre 1 e 12.").max(12, "Máximo de parcelas deve ser entre 1 e 12."),
  logoUrl: z.string().trim().max(4096, "URL da logo excede o limite de 4096 caracteres."),
  prazoGarantiaPadraoDias: z.coerce
    .number()
    .int("O prazo padrão de garantia deve ser um número inteiro válido.")
    .min(1, "O prazo padrão de garantia deve ser um número inteiro válido.")
    .max(3650, "O prazo padrão de garantia deve ser um número inteiro válido."),
  prazoMinimoGarantiaDias: z.coerce
    .number()
    .int("O prazo mínimo de garantia deve ser um número inteiro válido.")
    .min(1, "O prazo mínimo de garantia deve ser um número inteiro válido.")
    .max(3650, "O prazo mínimo de garantia deve ser um número inteiro válido."),
  prazoMaximoGarantiaDias: z.coerce
    .number()
    .int("O prazo máximo de garantia deve ser um número inteiro válido.")
    .min(1, "O prazo máximo de garantia deve ser um número inteiro válido.")
    .max(3650, "O prazo máximo de garantia deve ser um número inteiro válido."),
  exigirGarantiaAntesEntrega: z.boolean(),
  exigirItemParaGarantia: z.boolean(),
  exigirItemParaEnviarPDV: z.boolean(),
  exigirDiagnosticoParaFinalizar: z.boolean(),
  custoPecaOSJaPago: z.boolean(),
  permitirFinalizarSemPagamento: z.boolean(),
  permitirGarantiaPersonalizada: z.boolean(),
  textoCoberturaGarantia: z.string().trim().max(4000, "Texto de cobertura excede o limite de 4000 caracteres."),
  textoExclusoesGarantia: z.string().trim().max(4000, "Texto de exclusões excede o limite de 4000 caracteres."),
  textoResponsabilidadeDados: z.string().trim().max(4000, "Texto de responsabilidade por dados excede o limite de 4000 caracteres."),
}).superRefine((dados, contexto) => {
  if (dados.prazoMinimoGarantiaDias > dados.prazoGarantiaPadraoDias) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["prazoMinimoGarantiaDias"],
      message: "O prazo mínimo de garantia não pode ser maior que o prazo padrão.",
    });
  }

  if (dados.prazoGarantiaPadraoDias > dados.prazoMaximoGarantiaDias) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["prazoMaximoGarantiaDias"],
      message: "O prazo máximo de garantia não pode ser menor que o prazo padrão.",
    });
  }
});

function normalizarUrlImagem(url: string | null | undefined, nomeCampo: string): string | null {
  const valor = String(url ?? "").trim();

  if (!valor) {
    return null;
  }

  if (valor.length > 4096) {
    throw new Error(`${nomeCampo} excede o limite de 4096 caracteres.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(valor);
  } catch {
    throw new Error(`${nomeCampo} invalida. Use um link completo (https://...).`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${nomeCampo} invalida. Apenas URLs http/https sao permitidas.`);
  }

  return parsed.toString();
}

function obterDelegateConfiguracao(client: PrismaOperacionalTenant) {
  const prismaClient = client as PrismaConfiguracoesClient;
  return prismaClient.configuracao ?? prismaClient.Configuracao;
}

function obterConfiguracoesPadrao(): DadosConfiguracoes {
  const defaultsOsGarantias = obterDefaultsConfiguracaoOsGarantias();
  const defaultsPdv = obterDefaultsConfiguracaoPdv();

  return {
    razaoSocial: "",
    nomeFantasia: "Konext",
    cnpj: "",
    inscricaoEstadual: "",
    telefone: "",
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    endereco: "",
    mensagemCupom: "",
    modeloImpressaoOSPadrao: "A4",
    imprimirLogoTermica: true,
    mensagemRodapeImpressaoOS: "",
    permitirVendaSemEstoque: false,
    fechamentoAutomaticoCaixaAtivo: false,
    fechamentoAutomaticoCaixaHorario: "23:59",
    permitirPagamentoMisto: defaultsPdv.permitirPagamentoMisto,
    permitirDescontoPDV: defaultsPdv.permitirDescontoPDV,
    descontoMaximoPDVPercentual: defaultsPdv.descontoMaximoPDVPercentual,
    permitirVendaFiado: defaultsPdv.permitirVendaFiado,
    habilitarPix: defaultsPdv.habilitarPix,
    habilitarDinheiro: defaultsPdv.habilitarDinheiro,
    habilitarCartaoDebito: defaultsPdv.habilitarCartaoDebito,
    habilitarCartaoCredito: defaultsPdv.habilitarCartaoCredito,
    habilitarBoleto: defaultsPdv.habilitarBoleto,
    habilitarCrediario: defaultsPdv.habilitarCrediario,
    taxaCartaoDebitoPercentual: defaultsPdv.taxaCartaoDebitoPercentual,
    taxaCartaoCredito1xPercentual: defaultsPdv.taxaCartaoCredito1xPercentual,
    taxaCartaoCredito2xPercentual: defaultsPdv.taxaCartaoCredito2xPercentual,
    taxaCartaoCredito3xPercentual: defaultsPdv.taxaCartaoCredito3xPercentual,
    taxaCartaoCredito4xPercentual: defaultsPdv.taxaCartaoCredito4xPercentual,
    taxaCartaoCredito5xPercentual: defaultsPdv.taxaCartaoCredito5xPercentual,
    taxaCartaoCredito6xPercentual: defaultsPdv.taxaCartaoCredito6xPercentual,
    taxaCartaoCredito7xPercentual: defaultsPdv.taxaCartaoCredito7xPercentual,
    taxaCartaoCredito8xPercentual: defaultsPdv.taxaCartaoCredito8xPercentual,
    taxaCartaoCredito9xPercentual: defaultsPdv.taxaCartaoCredito9xPercentual,
    taxaCartaoCredito10xPercentual: defaultsPdv.taxaCartaoCredito10xPercentual,
    taxaCartaoCredito11xPercentual: defaultsPdv.taxaCartaoCredito11xPercentual,
    taxaCartaoCredito12xPercentual: defaultsPdv.taxaCartaoCredito12xPercentual,
    prazoPadraoBoletoDias: defaultsPdv.prazoPadraoBoletoDias,
    prazoPadraoCrediarioDias: defaultsPdv.prazoPadraoCrediarioDias,
    maxParcelasCartaoCredito: defaultsPdv.maxParcelasCartaoCredito,
    logoUrl: "",
    prazoGarantiaPadraoDias: defaultsOsGarantias.prazoGarantiaPadraoDias,
    prazoMinimoGarantiaDias: defaultsOsGarantias.prazoMinimoGarantiaDias,
    prazoMaximoGarantiaDias: defaultsOsGarantias.prazoMaximoGarantiaDias,
    exigirGarantiaAntesEntrega: defaultsOsGarantias.exigirGarantiaAntesEntrega,
    exigirItemParaGarantia: defaultsOsGarantias.exigirItemParaGarantia,
    exigirItemParaEnviarPDV: defaultsOsGarantias.exigirItemParaEnviarPDV,
    exigirDiagnosticoParaFinalizar: defaultsOsGarantias.exigirDiagnosticoParaFinalizar,
    custoPecaOSJaPago: defaultsOsGarantias.custoPecaOSJaPago,
    permitirFinalizarSemPagamento: defaultsOsGarantias.permitirFinalizarSemPagamento,
    permitirGarantiaPersonalizada: defaultsOsGarantias.permitirGarantiaPersonalizada,
    textoCoberturaGarantia: defaultsOsGarantias.textoCoberturaGarantia,
    textoExclusoesGarantia: defaultsOsGarantias.textoExclusoesGarantia,
    textoResponsabilidadeDados: defaultsOsGarantias.textoResponsabilidadeDados,
  };
}

type CamposOsGarantiaRaw = {
  prazoGarantiaPadraoDias: number | null;
  prazoMinimoGarantiaDias: number | null;
  prazoMaximoGarantiaDias: number | null;
  exigirGarantiaAntesEntrega: boolean | null;
  exigirItemParaGarantia: boolean | null;
  exigirItemParaEnviarPDV: boolean | null;
  exigirDiagnosticoParaFinalizar: boolean | null;
  custoPecaOSJaPago: boolean | null;
  permitirFinalizarSemPagamento: boolean | null;
  permitirGarantiaPersonalizada: boolean | null;
  textoCoberturaGarantia: string | null;
  textoExclusoesGarantia: string | null;
  textoResponsabilidadeDados: string | null;
};

type CamposPdvRaw = {
  permitirPagamentoMisto: boolean | null;
  permitirDescontoPDV: boolean | null;
  descontoMaximoPDVPercentual: unknown;
  permitirVendaFiado: boolean | null;
  habilitarPix: boolean | null;
  habilitarDinheiro: boolean | null;
  habilitarCartaoDebito: boolean | null;
  habilitarCartaoCredito: boolean | null;
  habilitarBoleto: boolean | null;
  habilitarCrediario: boolean | null;
  taxaCartaoDebitoPercentual: unknown;
  taxaCartaoCredito1xPercentual: unknown;
  taxaCartaoCredito2xPercentual: unknown;
  taxaCartaoCredito3xPercentual: unknown;
  taxaCartaoCredito4xPercentual: unknown;
  taxaCartaoCredito5xPercentual: unknown;
  taxaCartaoCredito6xPercentual: unknown;
  taxaCartaoCredito7xPercentual: unknown;
  taxaCartaoCredito8xPercentual: unknown;
  taxaCartaoCredito9xPercentual: unknown;
  taxaCartaoCredito10xPercentual: unknown;
  taxaCartaoCredito11xPercentual: unknown;
  taxaCartaoCredito12xPercentual: unknown;
  prazoPadraoBoletoDias: unknown;
  prazoPadraoCrediarioDias: unknown;
  maxParcelasCartaoCredito: unknown;
};

function decimalParaNumero(valor: unknown, fallback = 0): number {
  if (valor === null || valor === undefined) return fallback;

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : fallback;
  }

  if (typeof valor === "string") {
    // `lerEntradaMonetaria` e nao `Number(replace)`: o segundo recusa
    // "8.153,90" e aceita "8.153" como oito reais e quinze.
    const centavos = lerEntradaMonetaria(valor);
    return centavos === null ? fallback : paraMoeda(centavos);
  }

  if (
    typeof valor === "object" &&
    valor !== null &&
    "toString" in valor &&
    typeof valor.toString === "function"
  ) {
    const numero = Number(valor.toString());
    return Number.isFinite(numero) ? numero : fallback;
  }

  return fallback;
}

function inteiroParaNumero(valor: unknown, fallback: number, minimo: number, maximo: number): number {
  const numero = decimalParaNumero(valor, fallback);
  const inteiro = Math.trunc(numero);
  return Math.min(maximo, Math.max(minimo, inteiro));
}

async function lerCamposOsGarantiaViaSql(
  prismaClient: PrismaOperacionalTenant,
  id: string
): Promise<CamposOsGarantiaRaw | null> {
  if (!id) return null;
  try {
    const rows = await prismaClient.$queryRaw<Array<CamposOsGarantiaRaw>>`
      SELECT
        "prazoGarantiaPadraoDias",
        "prazoMinimoGarantiaDias",
        "prazoMaximoGarantiaDias",
        "exigirGarantiaAntesEntrega",
        "exigirItemParaGarantia",
        "exigirItemParaEnviarPDV",
        "exigirDiagnosticoParaFinalizar",
        "custoPecaOSJaPago",
        "permitirFinalizarSemPagamento",
        "permitirGarantiaPersonalizada",
        "textoCoberturaGarantia",
        "textoExclusoesGarantia",
        "textoResponsabilidadeDados"
      FROM "Configuracao"
      WHERE id = ${id}
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function normalizarConfiguracoesEntrada(data: DadosConfiguracoes): DadosConfiguracoes {
  const resultado = schemaDadosConfiguracoes.safeParse(data);

  if (!resultado.success) {
    throw new Error(resultado.error.issues[0]?.message ?? "Dados de configuração inválidos.");
  }

  const configuracaoPdvNormalizada = normalizarConfiguracaoPdv(resultado.data);

  if (!possuiFormaPagamentoHabilitada(configuracaoPdvNormalizada)) {
    throw new Error("Informe pelo menos uma forma de pagamento habilitada.");
  }

  return {
    ...resultado.data,
    ...configuracaoPdvNormalizada,
    nomeFantasia: resultado.data.nomeFantasia || "Konext",
    estado: resultado.data.estado.toUpperCase(),
    logoUrl: normalizarUrlImagem(resultado.data.logoUrl, "URL da logo da empresa") ?? "",
    textoCoberturaGarantia: resultado.data.textoCoberturaGarantia || TEXTO_COBERTURA_GARANTIA_PADRAO,
    textoExclusoesGarantia: resultado.data.textoExclusoesGarantia || TEXTO_EXCLUSOES_GARANTIA_PADRAO,
    textoResponsabilidadeDados:
      resultado.data.textoResponsabilidadeDados || TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
  };
}

export async function obterConfiguracoes(): Promise<{ id: string } & DadosConfiguracoes> {
  const contextoTenant = await exigirContextoTenant();
  const prismaTenant = contextoTenant.prisma;
  const configuracaoDelegate = obterDelegateConfiguracao(prismaTenant);

  if (!configuracaoDelegate?.findFirst) {
    return {
      id: "",
      ...obterConfiguracoesPadrao(),
    };
  }

  let configuracao: ConfiguracaoRegistro | null = (await configuracaoDelegate.findFirst({
    select: SELECAO_DE_CONFIGURACAO,
    orderBy: {
      criadoEm: "asc",
    },
  })) as ConfiguracaoRegistro | null;

  if (!configuracao && configuracaoDelegate.create) {
    try {
      configuracao = (await configuracaoDelegate.create({
        select: SELECAO_DE_CONFIGURACAO,
        data: {
          razaoSocial: "",
          nomeFantasia: "Konext",
          cnpj: "",
          inscricaoEstadual: "",
          telefone: "",
          cep: "",
          logradouro: "",
          numero: "",
          bairro: "",
          cidade: "",
          estado: "",
          endereco: "",
          mensagemCupom: null,
          permitirVendaSemEstoque: false,
          fechamentoAutomaticoCaixaAtivo: false,
          fechamentoAutomaticoCaixaHorario: "23:59",
          logoUrl: null,
          prazoGarantiaPadraoDias: 90,
          prazoMinimoGarantiaDias: 1,
          prazoMaximoGarantiaDias: 365,
          exigirGarantiaAntesEntrega: true,
          exigirItemParaGarantia: true,
          exigirItemParaEnviarPDV: true,
          exigirDiagnosticoParaFinalizar: false,
          custoPecaOSJaPago: true,
          permitirFinalizarSemPagamento: true,
          permitirGarantiaPersonalizada: true,
          textoCoberturaGarantia: TEXTO_COBERTURA_GARANTIA_PADRAO,
          textoExclusoesGarantia: TEXTO_EXCLUSOES_GARANTIA_PADRAO,
          textoResponsabilidadeDados: TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
        },
      })) as ConfiguracaoRegistro;
    } catch {
      configuracao = await configuracaoDelegate.findFirst({
        select: SELECAO_DE_CONFIGURACAO,
        orderBy: {
          criadoEm: "asc",
        },
      });
    }
  }

  const defaults = obterConfiguracoesPadrao();
  const defaultsPdv = obterDefaultsConfiguracaoPdv();

  // Se o cliente Prisma em memória não retornou os campos novos (runtime legado), busca via SQL.
  const camposOsGarantia: CamposOsGarantiaRaw | null =
    typeof (configuracao as Record<string, unknown> | null)?.exigirItemParaEnviarPDV === "boolean"
      ? (configuracao as unknown as CamposOsGarantiaRaw)
      : await lerCamposOsGarantiaViaSql(prismaTenant, configuracao?.id ? String(configuracao.id) : "");

  const camposPdv: CamposPdvRaw | null =
    typeof (configuracao as Record<string, unknown> | null)?.habilitarPix === "boolean"
      ? (configuracao as unknown as CamposPdvRaw)
      : await lerCamposPdvViaSql(prismaTenant, configuracao?.id ? String(configuracao.id) : "");

  return {
    id: configuracao?.id ? String(configuracao.id) : "",
    razaoSocial: configuracao?.razaoSocial ? String(configuracao.razaoSocial) : "",
    nomeFantasia: configuracao?.nomeFantasia ? String(configuracao.nomeFantasia) : "Konext",
    cnpj: configuracao?.cnpj ? String(configuracao.cnpj) : "",
    inscricaoEstadual: configuracao?.inscricaoEstadual ? String(configuracao.inscricaoEstadual) : "",
    telefone: configuracao?.telefone ? String(configuracao.telefone) : "",
    cep: configuracao?.cep ? String(configuracao.cep) : "",
    logradouro: configuracao?.logradouro ? String(configuracao.logradouro) : "",
    numero: configuracao?.numero ? String(configuracao.numero) : "",
    bairro: configuracao?.bairro ? String(configuracao.bairro) : "",
    cidade: configuracao?.cidade ? String(configuracao.cidade) : "",
    estado: configuracao?.estado ? String(configuracao.estado) : "",
    endereco: configuracao?.endereco ? String(configuracao.endereco) : "",
    mensagemCupom: configuracao?.mensagemCupom ? String(configuracao.mensagemCupom) : "",
    modeloImpressaoOSPadrao: configuracao?.modeloImpressaoOSPadrao === "TERMICA_80MM" ? "TERMICA_80MM" : "A4",
    imprimirLogoTermica:
      typeof configuracao?.imprimirLogoTermica === "boolean" ? Boolean(configuracao.imprimirLogoTermica) : true,
    mensagemRodapeImpressaoOS: configuracao?.mensagemRodapeImpressaoOS
      ? String(configuracao.mensagemRodapeImpressaoOS)
      : "",
    permitirVendaSemEstoque:
      typeof configuracao?.permitirVendaSemEstoque === "boolean"
        ? Boolean(configuracao.permitirVendaSemEstoque)
        : false,
    fechamentoAutomaticoCaixaAtivo:
      typeof configuracao?.fechamentoAutomaticoCaixaAtivo === "boolean"
        ? Boolean(configuracao.fechamentoAutomaticoCaixaAtivo)
        : false,
    fechamentoAutomaticoCaixaHorario: configuracao?.fechamentoAutomaticoCaixaHorario
      ? String(configuracao.fechamentoAutomaticoCaixaHorario)
      : "23:59",
    permitirPagamentoMisto:
      typeof camposPdv?.permitirPagamentoMisto === "boolean"
        ? Boolean(camposPdv.permitirPagamentoMisto)
        : defaultsPdv.permitirPagamentoMisto,
    permitirDescontoPDV:
      typeof camposPdv?.permitirDescontoPDV === "boolean"
        ? Boolean(camposPdv.permitirDescontoPDV)
        : defaultsPdv.permitirDescontoPDV,
    descontoMaximoPDVPercentual:
      decimalParaNumero(camposPdv?.descontoMaximoPDVPercentual, defaultsPdv.descontoMaximoPDVPercentual),
    permitirVendaFiado:
      typeof camposPdv?.permitirVendaFiado === "boolean"
        ? Boolean(camposPdv.permitirVendaFiado)
        : defaultsPdv.permitirVendaFiado,
    habilitarPix:
      typeof camposPdv?.habilitarPix === "boolean"
        ? Boolean(camposPdv.habilitarPix)
        : defaultsPdv.habilitarPix,
    habilitarDinheiro:
      typeof camposPdv?.habilitarDinheiro === "boolean"
        ? Boolean(camposPdv.habilitarDinheiro)
        : defaultsPdv.habilitarDinheiro,
    habilitarCartaoDebito:
      typeof camposPdv?.habilitarCartaoDebito === "boolean"
        ? Boolean(camposPdv.habilitarCartaoDebito)
        : defaultsPdv.habilitarCartaoDebito,
    habilitarCartaoCredito:
      typeof camposPdv?.habilitarCartaoCredito === "boolean"
        ? Boolean(camposPdv.habilitarCartaoCredito)
        : defaultsPdv.habilitarCartaoCredito,
    habilitarBoleto:
      typeof camposPdv?.habilitarBoleto === "boolean"
        ? Boolean(camposPdv.habilitarBoleto)
        : defaultsPdv.habilitarBoleto,
    habilitarCrediario:
      typeof camposPdv?.habilitarCrediario === "boolean"
        ? Boolean(camposPdv.habilitarCrediario)
        : defaultsPdv.habilitarCrediario,
    taxaCartaoDebitoPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoDebitoPercentual, defaultsPdv.taxaCartaoDebitoPercentual),
    taxaCartaoCredito1xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito1xPercentual, defaultsPdv.taxaCartaoCredito1xPercentual),
    taxaCartaoCredito2xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito2xPercentual, defaultsPdv.taxaCartaoCredito2xPercentual),
    taxaCartaoCredito3xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito3xPercentual, defaultsPdv.taxaCartaoCredito3xPercentual),
    taxaCartaoCredito4xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito4xPercentual, defaultsPdv.taxaCartaoCredito4xPercentual),
    taxaCartaoCredito5xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito5xPercentual, defaultsPdv.taxaCartaoCredito5xPercentual),
    taxaCartaoCredito6xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito6xPercentual, defaultsPdv.taxaCartaoCredito6xPercentual),
    taxaCartaoCredito7xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito7xPercentual, defaultsPdv.taxaCartaoCredito7xPercentual),
    taxaCartaoCredito8xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito8xPercentual, defaultsPdv.taxaCartaoCredito8xPercentual),
    taxaCartaoCredito9xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito9xPercentual, defaultsPdv.taxaCartaoCredito9xPercentual),
    taxaCartaoCredito10xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito10xPercentual, defaultsPdv.taxaCartaoCredito10xPercentual),
    taxaCartaoCredito11xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito11xPercentual, defaultsPdv.taxaCartaoCredito11xPercentual),
    taxaCartaoCredito12xPercentual:
      decimalParaNumero(camposPdv?.taxaCartaoCredito12xPercentual, defaultsPdv.taxaCartaoCredito12xPercentual),
    prazoPadraoBoletoDias:
      inteiroParaNumero(camposPdv?.prazoPadraoBoletoDias, defaultsPdv.prazoPadraoBoletoDias, 1, 365),
    prazoPadraoCrediarioDias:
      inteiroParaNumero(camposPdv?.prazoPadraoCrediarioDias, defaultsPdv.prazoPadraoCrediarioDias, 1, 365),
    maxParcelasCartaoCredito:
      inteiroParaNumero(camposPdv?.maxParcelasCartaoCredito, defaultsPdv.maxParcelasCartaoCredito, 1, 12),
    logoUrl: configuracao?.logoUrl ? String(configuracao.logoUrl) : "",
    prazoGarantiaPadraoDias:
      typeof camposOsGarantia?.prazoGarantiaPadraoDias === "number"
        ? Number(camposOsGarantia.prazoGarantiaPadraoDias)
        : defaults.prazoGarantiaPadraoDias,
    prazoMinimoGarantiaDias:
      typeof camposOsGarantia?.prazoMinimoGarantiaDias === "number"
        ? Number(camposOsGarantia.prazoMinimoGarantiaDias)
        : defaults.prazoMinimoGarantiaDias,
    prazoMaximoGarantiaDias:
      typeof camposOsGarantia?.prazoMaximoGarantiaDias === "number"
        ? Number(camposOsGarantia.prazoMaximoGarantiaDias)
        : defaults.prazoMaximoGarantiaDias,
    exigirGarantiaAntesEntrega:
      typeof camposOsGarantia?.exigirGarantiaAntesEntrega === "boolean"
        ? Boolean(camposOsGarantia.exigirGarantiaAntesEntrega)
        : defaults.exigirGarantiaAntesEntrega,
    exigirItemParaGarantia:
      typeof camposOsGarantia?.exigirItemParaGarantia === "boolean"
        ? Boolean(camposOsGarantia.exigirItemParaGarantia)
        : defaults.exigirItemParaGarantia,
    exigirItemParaEnviarPDV:
      typeof camposOsGarantia?.exigirItemParaEnviarPDV === "boolean"
        ? Boolean(camposOsGarantia.exigirItemParaEnviarPDV)
        : defaults.exigirItemParaEnviarPDV,
    exigirDiagnosticoParaFinalizar:
      typeof camposOsGarantia?.exigirDiagnosticoParaFinalizar === "boolean"
        ? Boolean(camposOsGarantia.exigirDiagnosticoParaFinalizar)
        : defaults.exigirDiagnosticoParaFinalizar,
    custoPecaOSJaPago:
      typeof camposOsGarantia?.custoPecaOSJaPago === "boolean"
        ? Boolean(camposOsGarantia.custoPecaOSJaPago)
        : defaults.custoPecaOSJaPago,
    permitirFinalizarSemPagamento:
      typeof camposOsGarantia?.permitirFinalizarSemPagamento === "boolean"
        ? Boolean(camposOsGarantia.permitirFinalizarSemPagamento)
        : defaults.permitirFinalizarSemPagamento,
    permitirGarantiaPersonalizada:
      typeof camposOsGarantia?.permitirGarantiaPersonalizada === "boolean"
        ? Boolean(camposOsGarantia.permitirGarantiaPersonalizada)
        : defaults.permitirGarantiaPersonalizada,
    textoCoberturaGarantia: camposOsGarantia?.textoCoberturaGarantia
      ? String(camposOsGarantia.textoCoberturaGarantia)
      : defaults.textoCoberturaGarantia,
    textoExclusoesGarantia: camposOsGarantia?.textoExclusoesGarantia
      ? String(camposOsGarantia.textoExclusoesGarantia)
      : defaults.textoExclusoesGarantia,
    textoResponsabilidadeDados: camposOsGarantia?.textoResponsabilidadeDados
      ? String(camposOsGarantia.textoResponsabilidadeDados)
      : defaults.textoResponsabilidadeDados,
  };
}

function mensagemIndicaRuntimeLegadoConfiguracao(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : "";
  return mensagem.includes("Unknown argument") || mensagem.includes("Invalid `configuracaoDelegate");
}

function houveMudancaCamposOsGarantia(antes: DadosConfiguracoes, depois: DadosConfiguracoes): boolean {
  return (
    antes.prazoGarantiaPadraoDias !== depois.prazoGarantiaPadraoDias ||
    antes.prazoMinimoGarantiaDias !== depois.prazoMinimoGarantiaDias ||
    antes.prazoMaximoGarantiaDias !== depois.prazoMaximoGarantiaDias ||
    antes.exigirGarantiaAntesEntrega !== depois.exigirGarantiaAntesEntrega ||
    antes.exigirItemParaGarantia !== depois.exigirItemParaGarantia ||
    antes.exigirItemParaEnviarPDV !== depois.exigirItemParaEnviarPDV ||
    antes.exigirDiagnosticoParaFinalizar !== depois.exigirDiagnosticoParaFinalizar ||
    antes.custoPecaOSJaPago !== depois.custoPecaOSJaPago ||
    antes.permitirFinalizarSemPagamento !== depois.permitirFinalizarSemPagamento ||
    antes.permitirGarantiaPersonalizada !== depois.permitirGarantiaPersonalizada ||
    antes.textoCoberturaGarantia !== depois.textoCoberturaGarantia ||
    antes.textoExclusoesGarantia !== depois.textoExclusoesGarantia ||
    antes.textoResponsabilidadeDados !== depois.textoResponsabilidadeDados
  );
}

function houveMudancaCamposPdv(antes: DadosConfiguracoes, depois: DadosConfiguracoes): boolean {
  return (
    antes.permitirPagamentoMisto !== depois.permitirPagamentoMisto ||
    antes.permitirDescontoPDV !== depois.permitirDescontoPDV ||
    antes.descontoMaximoPDVPercentual !== depois.descontoMaximoPDVPercentual ||
    antes.permitirVendaFiado !== depois.permitirVendaFiado ||
    antes.habilitarPix !== depois.habilitarPix ||
    antes.habilitarDinheiro !== depois.habilitarDinheiro ||
    antes.habilitarCartaoDebito !== depois.habilitarCartaoDebito ||
    antes.habilitarCartaoCredito !== depois.habilitarCartaoCredito ||
    antes.habilitarBoleto !== depois.habilitarBoleto ||
    antes.habilitarCrediario !== depois.habilitarCrediario ||
    antes.taxaCartaoDebitoPercentual !== depois.taxaCartaoDebitoPercentual ||
    antes.taxaCartaoCredito1xPercentual !== depois.taxaCartaoCredito1xPercentual ||
    antes.taxaCartaoCredito2xPercentual !== depois.taxaCartaoCredito2xPercentual ||
    antes.taxaCartaoCredito3xPercentual !== depois.taxaCartaoCredito3xPercentual ||
    antes.taxaCartaoCredito4xPercentual !== depois.taxaCartaoCredito4xPercentual ||
    antes.taxaCartaoCredito5xPercentual !== depois.taxaCartaoCredito5xPercentual ||
    antes.taxaCartaoCredito6xPercentual !== depois.taxaCartaoCredito6xPercentual ||
    antes.taxaCartaoCredito7xPercentual !== depois.taxaCartaoCredito7xPercentual ||
    antes.taxaCartaoCredito8xPercentual !== depois.taxaCartaoCredito8xPercentual ||
    antes.taxaCartaoCredito9xPercentual !== depois.taxaCartaoCredito9xPercentual ||
    antes.taxaCartaoCredito10xPercentual !== depois.taxaCartaoCredito10xPercentual ||
    antes.taxaCartaoCredito11xPercentual !== depois.taxaCartaoCredito11xPercentual ||
    antes.taxaCartaoCredito12xPercentual !== depois.taxaCartaoCredito12xPercentual ||
    antes.prazoPadraoBoletoDias !== depois.prazoPadraoBoletoDias ||
    antes.prazoPadraoCrediarioDias !== depois.prazoPadraoCrediarioDias ||
    antes.maxParcelasCartaoCredito !== depois.maxParcelasCartaoCredito
  );
}

async function atualizarCamposOsGarantiaComFallbackSql(prismaClient: PrismaOperacionalTenant, configuracaoId: string, dados: {
  prazoGarantiaPadraoDias: number;
  prazoMinimoGarantiaDias: number;
  prazoMaximoGarantiaDias: number;
  exigirGarantiaAntesEntrega: boolean;
  exigirItemParaGarantia: boolean;
  exigirItemParaEnviarPDV: boolean;
  exigirDiagnosticoParaFinalizar: boolean;
  custoPecaOSJaPago: boolean;
  permitirFinalizarSemPagamento: boolean;
  permitirGarantiaPersonalizada: boolean;
  textoCoberturaGarantia: string | null;
  textoExclusoesGarantia: string | null;
  textoResponsabilidadeDados: string | null;
}) {
  await prismaClient.$executeRaw`
    UPDATE "Configuracao"
    SET
      "prazoGarantiaPadraoDias" = ${dados.prazoGarantiaPadraoDias},
      "prazoMinimoGarantiaDias" = ${dados.prazoMinimoGarantiaDias},
      "prazoMaximoGarantiaDias" = ${dados.prazoMaximoGarantiaDias},
      "exigirGarantiaAntesEntrega" = ${dados.exigirGarantiaAntesEntrega},
      "exigirItemParaGarantia" = ${dados.exigirItemParaGarantia},
      "exigirItemParaEnviarPDV" = ${dados.exigirItemParaEnviarPDV},
      "exigirDiagnosticoParaFinalizar" = ${dados.exigirDiagnosticoParaFinalizar},
      "custoPecaOSJaPago" = ${dados.custoPecaOSJaPago},
      "permitirFinalizarSemPagamento" = ${dados.permitirFinalizarSemPagamento},
      "permitirGarantiaPersonalizada" = ${dados.permitirGarantiaPersonalizada},
      "textoCoberturaGarantia" = ${dados.textoCoberturaGarantia},
      "textoExclusoesGarantia" = ${dados.textoExclusoesGarantia},
      "textoResponsabilidadeDados" = ${dados.textoResponsabilidadeDados},
      "atualizadoEm" = NOW()
    WHERE id = ${configuracaoId}
  `;
}

async function atualizarCamposPdvComFallbackSql(prismaClient: PrismaOperacionalTenant, configuracaoId: string, dados: {
  permitirPagamentoMisto: boolean;
  permitirDescontoPDV: boolean;
  descontoMaximoPDVPercentual: number;
  permitirVendaFiado: boolean;
  habilitarPix: boolean;
  habilitarDinheiro: boolean;
  habilitarCartaoDebito: boolean;
  habilitarCartaoCredito: boolean;
  habilitarBoleto: boolean;
  habilitarCrediario: boolean;
  taxaCartaoDebitoPercentual: number;
  taxaCartaoCredito1xPercentual: number;
  taxaCartaoCredito2xPercentual: number;
  taxaCartaoCredito3xPercentual: number;
  taxaCartaoCredito4xPercentual: number;
  taxaCartaoCredito5xPercentual: number;
  taxaCartaoCredito6xPercentual: number;
  taxaCartaoCredito7xPercentual: number;
  taxaCartaoCredito8xPercentual: number;
  taxaCartaoCredito9xPercentual: number;
  taxaCartaoCredito10xPercentual: number;
  taxaCartaoCredito11xPercentual: number;
  taxaCartaoCredito12xPercentual: number;
  prazoPadraoBoletoDias: number;
  prazoPadraoCrediarioDias: number;
  maxParcelasCartaoCredito: number;
}) {
  await prismaClient.$executeRaw`
    UPDATE "Configuracao"
    SET
      "permitirPagamentoMisto" = ${dados.permitirPagamentoMisto},
      "permitirDescontoPDV" = ${dados.permitirDescontoPDV},
      "descontoMaximoPDVPercentual" = ${dados.descontoMaximoPDVPercentual},
      "permitirVendaFiado" = ${dados.permitirVendaFiado},
      "habilitarPix" = ${dados.habilitarPix},
      "habilitarDinheiro" = ${dados.habilitarDinheiro},
      "habilitarCartaoDebito" = ${dados.habilitarCartaoDebito},
      "habilitarCartaoCredito" = ${dados.habilitarCartaoCredito},
      "habilitarBoleto" = ${dados.habilitarBoleto},
      "habilitarCrediario" = ${dados.habilitarCrediario},
      "taxaCartaoDebitoPercentual" = ${dados.taxaCartaoDebitoPercentual},
      "taxaCartaoCredito1xPercentual" = ${dados.taxaCartaoCredito1xPercentual},
      "taxaCartaoCredito2xPercentual" = ${dados.taxaCartaoCredito2xPercentual},
      "taxaCartaoCredito3xPercentual" = ${dados.taxaCartaoCredito3xPercentual},
      "taxaCartaoCredito4xPercentual" = ${dados.taxaCartaoCredito4xPercentual},
      "taxaCartaoCredito5xPercentual" = ${dados.taxaCartaoCredito5xPercentual},
      "taxaCartaoCredito6xPercentual" = ${dados.taxaCartaoCredito6xPercentual},
      "taxaCartaoCredito7xPercentual" = ${dados.taxaCartaoCredito7xPercentual},
      "taxaCartaoCredito8xPercentual" = ${dados.taxaCartaoCredito8xPercentual},
      "taxaCartaoCredito9xPercentual" = ${dados.taxaCartaoCredito9xPercentual},
      "taxaCartaoCredito10xPercentual" = ${dados.taxaCartaoCredito10xPercentual},
      "taxaCartaoCredito11xPercentual" = ${dados.taxaCartaoCredito11xPercentual},
      "taxaCartaoCredito12xPercentual" = ${dados.taxaCartaoCredito12xPercentual},
      "prazoPadraoBoletoDias" = ${dados.prazoPadraoBoletoDias},
      "prazoPadraoCrediarioDias" = ${dados.prazoPadraoCrediarioDias},
      "maxParcelasCartaoCredito" = ${dados.maxParcelasCartaoCredito},
      "atualizadoEm" = NOW()
    WHERE id = ${configuracaoId}
  `;
}

export async function salvarConfiguracoes(data: DadosConfiguracoes) {
  // C1: exige sessao valida e resolve o tenant antes de alterar configuracoes da empresa.
  const contextoTenant = await exigirContextoTenant();
  // Um unico formulario grava identidade da empresa e regras de sistema juntas
  // (F-31: 69 campos numa so Configuracao); gateamos pela mais restritiva.
  // Nem ADMIN nem GESTOR sao afetados; so GESTOR perde acesso, por desenho.
  exigirPermissao(contextoTenant, "configuracoes.sistema");
  const usuario = contextoTenant.usuarioOperacional;
  const prismaTenant = contextoTenant.prisma;

  const dadosNormalizados = normalizarConfiguracoesEntrada(data);

  const configuracaoDelegate = obterDelegateConfiguracao(prismaTenant);

  if (!configuracaoDelegate?.findFirst || !configuracaoDelegate?.update) {
    throw new Error("Delegate Prisma de Configuracao nao disponivel.");
  }

  let configuracao: ConfiguracaoRegistro | null = (await configuracaoDelegate.findFirst({
    select: SELECAO_DE_CONFIGURACAO,
    orderBy: {
      criadoEm: "asc",
    },
  })) as ConfiguracaoRegistro | null;

  if (!configuracao && configuracaoDelegate.create) {
    configuracao = (await configuracaoDelegate.create({
      select: SELECAO_DE_CONFIGURACAO,
      data: {
        razaoSocial: "",
        nomeFantasia: "Konext",
        cnpj: "",
        inscricaoEstadual: "",
        telefone: "",
        cep: "",
        logradouro: "",
        numero: "",
        bairro: "",
        cidade: "",
        estado: "",
        endereco: "",
        mensagemCupom: null,
        modeloImpressaoOSPadrao: "A4",
        imprimirLogoTermica: true,
        mensagemRodapeImpressaoOS: null,
        permitirVendaSemEstoque: false,
        fechamentoAutomaticoCaixaAtivo: false,
        fechamentoAutomaticoCaixaHorario: "23:59",
        permitirPagamentoMisto: true,
        permitirDescontoPDV: true,
        descontoMaximoPDVPercentual: 0,
        permitirVendaFiado: false,
        habilitarPix: true,
        habilitarDinheiro: true,
        habilitarCartaoDebito: true,
        habilitarCartaoCredito: true,
        habilitarBoleto: false,
        habilitarCrediario: false,
        taxaCartaoDebitoPercentual: 0,
        taxaCartaoCredito1xPercentual: 0,
        taxaCartaoCredito2xPercentual: 0,
        taxaCartaoCredito3xPercentual: 0,
        taxaCartaoCredito4xPercentual: 0,
        taxaCartaoCredito5xPercentual: 0,
        taxaCartaoCredito6xPercentual: 0,
        taxaCartaoCredito7xPercentual: 0,
        taxaCartaoCredito8xPercentual: 0,
        taxaCartaoCredito9xPercentual: 0,
        taxaCartaoCredito10xPercentual: 0,
        taxaCartaoCredito11xPercentual: 0,
        taxaCartaoCredito12xPercentual: 0,
        prazoPadraoBoletoDias: 7,
        prazoPadraoCrediarioDias: 30,
        maxParcelasCartaoCredito: 12,
        logoUrl: null,
      },
    })) as ConfiguracaoRegistro;
  }

  if (!configuracao) {
    throw new Error("Nao foi possivel inicializar as configuracoes do sistema.");
  }

  const dadosAntes = await obterConfiguracoes();

  const dadosBaseAtualizacao = {
    razaoSocial: dadosNormalizados.razaoSocial,
    nomeFantasia: dadosNormalizados.nomeFantasia,
    cnpj: dadosNormalizados.cnpj,
    inscricaoEstadual: dadosNormalizados.inscricaoEstadual,
    telefone: dadosNormalizados.telefone,
    cep: dadosNormalizados.cep,
    logradouro: dadosNormalizados.logradouro,
    numero: dadosNormalizados.numero,
    bairro: dadosNormalizados.bairro,
    cidade: dadosNormalizados.cidade,
    estado: dadosNormalizados.estado,
    endereco: dadosNormalizados.endereco,
    mensagemCupom: dadosNormalizados.mensagemCupom || null,
    modeloImpressaoOSPadrao: dadosNormalizados.modeloImpressaoOSPadrao,
    imprimirLogoTermica: dadosNormalizados.imprimirLogoTermica,
    mensagemRodapeImpressaoOS: dadosNormalizados.mensagemRodapeImpressaoOS || null,
    permitirVendaSemEstoque: dadosNormalizados.permitirVendaSemEstoque,
    fechamentoAutomaticoCaixaAtivo: dadosNormalizados.fechamentoAutomaticoCaixaAtivo,
    fechamentoAutomaticoCaixaHorario: dadosNormalizados.fechamentoAutomaticoCaixaHorario,
    logoUrl: dadosNormalizados.logoUrl || null,
  };

  const dadosOsGarantiaAtualizacao = {
    prazoGarantiaPadraoDias: dadosNormalizados.prazoGarantiaPadraoDias,
    prazoMinimoGarantiaDias: dadosNormalizados.prazoMinimoGarantiaDias,
    prazoMaximoGarantiaDias: dadosNormalizados.prazoMaximoGarantiaDias,
    exigirGarantiaAntesEntrega: dadosNormalizados.exigirGarantiaAntesEntrega,
    exigirItemParaGarantia: dadosNormalizados.exigirItemParaGarantia,
    exigirItemParaEnviarPDV: dadosNormalizados.exigirItemParaEnviarPDV,
    exigirDiagnosticoParaFinalizar: dadosNormalizados.exigirDiagnosticoParaFinalizar,
    custoPecaOSJaPago: dadosNormalizados.custoPecaOSJaPago,
    permitirFinalizarSemPagamento: dadosNormalizados.permitirFinalizarSemPagamento,
    permitirGarantiaPersonalizada: dadosNormalizados.permitirGarantiaPersonalizada,
    textoCoberturaGarantia: dadosNormalizados.textoCoberturaGarantia || null,
    textoExclusoesGarantia: dadosNormalizados.textoExclusoesGarantia || null,
    textoResponsabilidadeDados: dadosNormalizados.textoResponsabilidadeDados || null,
  };

  const dadosPdvAtualizacao = {
    permitirPagamentoMisto: dadosNormalizados.permitirPagamentoMisto,
    permitirDescontoPDV: dadosNormalizados.permitirDescontoPDV,
    descontoMaximoPDVPercentual: dadosNormalizados.descontoMaximoPDVPercentual,
    permitirVendaFiado: dadosNormalizados.permitirVendaFiado,
    habilitarPix: dadosNormalizados.habilitarPix,
    habilitarDinheiro: dadosNormalizados.habilitarDinheiro,
    habilitarCartaoDebito: dadosNormalizados.habilitarCartaoDebito,
    habilitarCartaoCredito: dadosNormalizados.habilitarCartaoCredito,
    habilitarBoleto: dadosNormalizados.habilitarBoleto,
    habilitarCrediario: dadosNormalizados.habilitarCrediario,
    taxaCartaoDebitoPercentual: dadosNormalizados.taxaCartaoDebitoPercentual,
    taxaCartaoCredito1xPercentual: dadosNormalizados.taxaCartaoCredito1xPercentual,
    taxaCartaoCredito2xPercentual: dadosNormalizados.taxaCartaoCredito2xPercentual,
    taxaCartaoCredito3xPercentual: dadosNormalizados.taxaCartaoCredito3xPercentual,
    taxaCartaoCredito4xPercentual: dadosNormalizados.taxaCartaoCredito4xPercentual,
    taxaCartaoCredito5xPercentual: dadosNormalizados.taxaCartaoCredito5xPercentual,
    taxaCartaoCredito6xPercentual: dadosNormalizados.taxaCartaoCredito6xPercentual,
    taxaCartaoCredito7xPercentual: dadosNormalizados.taxaCartaoCredito7xPercentual,
    taxaCartaoCredito8xPercentual: dadosNormalizados.taxaCartaoCredito8xPercentual,
    taxaCartaoCredito9xPercentual: dadosNormalizados.taxaCartaoCredito9xPercentual,
    taxaCartaoCredito10xPercentual: dadosNormalizados.taxaCartaoCredito10xPercentual,
    taxaCartaoCredito11xPercentual: dadosNormalizados.taxaCartaoCredito11xPercentual,
    taxaCartaoCredito12xPercentual: dadosNormalizados.taxaCartaoCredito12xPercentual,
    prazoPadraoBoletoDias: dadosNormalizados.prazoPadraoBoletoDias,
    prazoPadraoCrediarioDias: dadosNormalizados.prazoPadraoCrediarioDias,
    maxParcelasCartaoCredito: dadosNormalizados.maxParcelasCartaoCredito,
  };

  await configuracaoDelegate.update({
    select: SELECAO_SO_O_ID,
    where: {
      id: configuracao.id,
    },
    data: dadosBaseAtualizacao,
  });

  const precisaSalvarCamposOsGarantia = houveMudancaCamposOsGarantia(dadosAntes, dadosNormalizados);
  const precisaSalvarCamposPdv = houveMudancaCamposPdv(dadosAntes, dadosNormalizados);

  if (precisaSalvarCamposOsGarantia) {
    try {
      await configuracaoDelegate.update({
        select: SELECAO_SO_O_ID,
        where: {
          id: configuracao.id,
        },
        data: dadosOsGarantiaAtualizacao,
      });
    } catch (erro) {
      if (mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
        await atualizarCamposOsGarantiaComFallbackSql(prismaTenant, configuracao.id, dadosOsGarantiaAtualizacao);
      } else {
        throw erro;
      }
    }
  }

  if (precisaSalvarCamposPdv) {
    try {
      await configuracaoDelegate.update({
        select: SELECAO_SO_O_ID,
        where: {
          id: configuracao.id,
        },
        data: dadosPdvAtualizacao,
      });
    } catch (erro) {
      if (mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
        await atualizarCamposPdvComFallbackSql(prismaTenant, configuracao.id, dadosPdvAtualizacao);
      } else {
        throw erro;
      }
    }
  }

  if (precisaSalvarCamposOsGarantia) {
    await registrarLogAuditoria(
      prismaTenant,
      contextoAuditoriaDoUsuario(usuario, "app/actions/configuracoes.ts:salvarConfiguracoes"),
      {
        acao: ACOES_AUDITORIA.ATUALIZAR_CONFIGURACOES_OS_GARANTIA,
        entidade: ENTIDADES_AUDITORIA.CONFIGURACAO,
        entidadeId: configuracao.id,
        dadosAntes: {
          prazoGarantiaPadraoDias: dadosAntes.prazoGarantiaPadraoDias,
          prazoMinimoGarantiaDias: dadosAntes.prazoMinimoGarantiaDias,
          prazoMaximoGarantiaDias: dadosAntes.prazoMaximoGarantiaDias,
          exigirGarantiaAntesEntrega: dadosAntes.exigirGarantiaAntesEntrega,
          exigirItemParaGarantia: dadosAntes.exigirItemParaGarantia,
          exigirItemParaEnviarPDV: dadosAntes.exigirItemParaEnviarPDV,
          exigirDiagnosticoParaFinalizar: dadosAntes.exigirDiagnosticoParaFinalizar,
          custoPecaOSJaPago: dadosAntes.custoPecaOSJaPago,
          permitirFinalizarSemPagamento: dadosAntes.permitirFinalizarSemPagamento,
          permitirGarantiaPersonalizada: dadosAntes.permitirGarantiaPersonalizada,
        },
        dadosDepois: {
          prazoGarantiaPadraoDias: dadosNormalizados.prazoGarantiaPadraoDias,
          prazoMinimoGarantiaDias: dadosNormalizados.prazoMinimoGarantiaDias,
          prazoMaximoGarantiaDias: dadosNormalizados.prazoMaximoGarantiaDias,
          exigirGarantiaAntesEntrega: dadosNormalizados.exigirGarantiaAntesEntrega,
          exigirItemParaGarantia: dadosNormalizados.exigirItemParaGarantia,
          exigirItemParaEnviarPDV: dadosNormalizados.exigirItemParaEnviarPDV,
          exigirDiagnosticoParaFinalizar: dadosNormalizados.exigirDiagnosticoParaFinalizar,
          custoPecaOSJaPago: dadosNormalizados.custoPecaOSJaPago,
          permitirFinalizarSemPagamento: dadosNormalizados.permitirFinalizarSemPagamento,
          permitirGarantiaPersonalizada: dadosNormalizados.permitirGarantiaPersonalizada,
        },
      }
    );
  }

  if (precisaSalvarCamposPdv) {
    await registrarLogAuditoria(
      prismaTenant,
      contextoAuditoriaDoUsuario(usuario, "app/actions/configuracoes.ts:salvarConfiguracoes"),
      {
        acao: ACOES_AUDITORIA.ATUALIZAR_CONFIGURACOES_PDV,
        entidade: ENTIDADES_AUDITORIA.CONFIGURACAO,
        entidadeId: configuracao.id,
        dadosAntes: {
          permitirPagamentoMisto: dadosAntes.permitirPagamentoMisto,
          permitirDescontoPDV: dadosAntes.permitirDescontoPDV,
          descontoMaximoPDVPercentual: dadosAntes.descontoMaximoPDVPercentual,
          permitirVendaFiado: dadosAntes.permitirVendaFiado,
          habilitarPix: dadosAntes.habilitarPix,
          habilitarDinheiro: dadosAntes.habilitarDinheiro,
          habilitarCartaoDebito: dadosAntes.habilitarCartaoDebito,
          habilitarCartaoCredito: dadosAntes.habilitarCartaoCredito,
          habilitarBoleto: dadosAntes.habilitarBoleto,
          habilitarCrediario: dadosAntes.habilitarCrediario,
          taxaCartaoDebitoPercentual: dadosAntes.taxaCartaoDebitoPercentual,
          taxaCartaoCredito1xPercentual: dadosAntes.taxaCartaoCredito1xPercentual,
          taxaCartaoCredito2xPercentual: dadosAntes.taxaCartaoCredito2xPercentual,
          taxaCartaoCredito3xPercentual: dadosAntes.taxaCartaoCredito3xPercentual,
          taxaCartaoCredito4xPercentual: dadosAntes.taxaCartaoCredito4xPercentual,
          taxaCartaoCredito5xPercentual: dadosAntes.taxaCartaoCredito5xPercentual,
          taxaCartaoCredito6xPercentual: dadosAntes.taxaCartaoCredito6xPercentual,
          taxaCartaoCredito7xPercentual: dadosAntes.taxaCartaoCredito7xPercentual,
          taxaCartaoCredito8xPercentual: dadosAntes.taxaCartaoCredito8xPercentual,
          taxaCartaoCredito9xPercentual: dadosAntes.taxaCartaoCredito9xPercentual,
          taxaCartaoCredito10xPercentual: dadosAntes.taxaCartaoCredito10xPercentual,
          taxaCartaoCredito11xPercentual: dadosAntes.taxaCartaoCredito11xPercentual,
          taxaCartaoCredito12xPercentual: dadosAntes.taxaCartaoCredito12xPercentual,
          prazoPadraoBoletoDias: dadosAntes.prazoPadraoBoletoDias,
          prazoPadraoCrediarioDias: dadosAntes.prazoPadraoCrediarioDias,
          maxParcelasCartaoCredito: dadosAntes.maxParcelasCartaoCredito,
        },
        dadosDepois: {
          permitirPagamentoMisto: dadosNormalizados.permitirPagamentoMisto,
          permitirDescontoPDV: dadosNormalizados.permitirDescontoPDV,
          descontoMaximoPDVPercentual: dadosNormalizados.descontoMaximoPDVPercentual,
          permitirVendaFiado: dadosNormalizados.permitirVendaFiado,
          habilitarPix: dadosNormalizados.habilitarPix,
          habilitarDinheiro: dadosNormalizados.habilitarDinheiro,
          habilitarCartaoDebito: dadosNormalizados.habilitarCartaoDebito,
          habilitarCartaoCredito: dadosNormalizados.habilitarCartaoCredito,
          habilitarBoleto: dadosNormalizados.habilitarBoleto,
          habilitarCrediario: dadosNormalizados.habilitarCrediario,
          taxaCartaoDebitoPercentual: dadosNormalizados.taxaCartaoDebitoPercentual,
          taxaCartaoCredito1xPercentual: dadosNormalizados.taxaCartaoCredito1xPercentual,
          taxaCartaoCredito2xPercentual: dadosNormalizados.taxaCartaoCredito2xPercentual,
          taxaCartaoCredito3xPercentual: dadosNormalizados.taxaCartaoCredito3xPercentual,
          taxaCartaoCredito4xPercentual: dadosNormalizados.taxaCartaoCredito4xPercentual,
          taxaCartaoCredito5xPercentual: dadosNormalizados.taxaCartaoCredito5xPercentual,
          taxaCartaoCredito6xPercentual: dadosNormalizados.taxaCartaoCredito6xPercentual,
          taxaCartaoCredito7xPercentual: dadosNormalizados.taxaCartaoCredito7xPercentual,
          taxaCartaoCredito8xPercentual: dadosNormalizados.taxaCartaoCredito8xPercentual,
          taxaCartaoCredito9xPercentual: dadosNormalizados.taxaCartaoCredito9xPercentual,
          taxaCartaoCredito10xPercentual: dadosNormalizados.taxaCartaoCredito10xPercentual,
          taxaCartaoCredito11xPercentual: dadosNormalizados.taxaCartaoCredito11xPercentual,
          taxaCartaoCredito12xPercentual: dadosNormalizados.taxaCartaoCredito12xPercentual,
          prazoPadraoBoletoDias: dadosNormalizados.prazoPadraoBoletoDias,
          prazoPadraoCrediarioDias: dadosNormalizados.prazoPadraoCrediarioDias,
          maxParcelasCartaoCredito: dadosNormalizados.maxParcelasCartaoCredito,
        },
      }
    );
  }

  revalidatePath("/configuracoes");
  revalidatePath("/pdv");
  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  revalidatePath("/os");
  revalidatePath("/");
  revalidatePath("/crm/propostas");
  revalidatePath("/vendas");
  revalidatePath("/", "layout");
}

export async function consultarCnpjReceita(cnpj: string): Promise<ResultadoConsultaCnpj> {
  // Exige sessao ANTES do try: sem ela, o redirect do login precisa subir.
  //
  // Esta action nao le nada do banco, e por isso nunca tinha conferido quem
  // chamava. Mas ela faz uma requisicao a um servico externo em nome do
  // sistema: aberta, era um repetidor publico — qualquer pessoa na internet
  // consumia a cota de consultas de CNPJ da loja, sem login.
  await exigirContextoTenant();

  try {
    const resultado = await consultarCnpjReceitaCliente(cnpj);

    if (!resultado.sucesso) {
      return {
        sucesso: false,
        erro: resultado.mensagem,
      };
    }

    return {
      sucesso: true,
      dados: {
        razaoSocial: resultado.dados.nomeRazaoSocial,
        nomeFantasia: resultado.dados.nomeFantasia,
        cnpj: resultado.dados.documento ?? "",
        inscricaoEstadual: resultado.dados.inscricaoEstadual,
        telefone: resultado.dados.telefone,
        cep: resultado.dados.cep,
        logradouro: resultado.dados.logradouro,
        numero: resultado.dados.numero,
        bairro: resultado.dados.bairro,
        cidade: resultado.dados.cidade,
        estado: resultado.dados.estado,
      },
    };
  } catch {
    return {
      sucesso: false,
      erro: "Falha ao consultar Receita.",
    };
  }
}

export async function obterDadosPerfilConfiguracao() {
  const contextoTenant = await exigirContextoTenant();
  const prismaTenant = contextoTenant.prisma as PrismaConfiguracoesClient;

  const configuracaoDelegate = obterDelegateConfiguracao(contextoTenant.prisma);
  // So as tres colunas que esta funcao devolve. Ela roda no layout de TODA
  // tela do sistema; trazer as 60 colunas da configuracao para usar tres era
  // o maior desperdicio fixo de cada carregamento.
  const configuracao = configuracaoDelegate?.findFirst
    ? await configuracaoDelegate.findFirst({
        select: { id: true, nomeFantasia: true, logoUrl: true },
        orderBy: {
          criadoEm: "asc",
        },
      })
    : null;

  // Identidade exibida: usuario operacional mapeado (quando existe) ou dados da sessao central.
  let fotoPerfilUrl: string | null = null;
  const usuarioOperacionalId = contextoTenant.usuarioOperacional.id;

  if (usuarioOperacionalId) {
    try {
      const usuarioDelegate = prismaTenant.usuario ?? prismaTenant.Usuario;
      const usuarioOperacional = usuarioDelegate?.findUnique
        ? await usuarioDelegate.findUnique({
            where: { id: usuarioOperacionalId },
            // Sem `select` vinha a linha inteira do usuario — inclusive a
            // coluna `senha` — para usar um unico campo.
            select: { fotoPerfilUrl: true },
          })
        : null;
      fotoPerfilUrl = usuarioOperacional?.fotoPerfilUrl ? String(usuarioOperacional.fotoPerfilUrl) : null;
    } catch {
      fotoPerfilUrl = null;
    }
  }

  return {
    usuario: {
      id: usuarioOperacionalId || contextoTenant.usuarioCentralId,
      nome: contextoTenant.usuarioOperacional.nome,
      email: contextoTenant.usuarioOperacional.email,
      fotoPerfilUrl,
      role: contextoTenant.usuarioOperacional.role,
    },
    configuracao: configuracao
      ? {
          id: String(configuracao.id),
          nomeFantasia: String(configuracao.nomeFantasia),
          logoUrl: configuracao.logoUrl ? String(configuracao.logoUrl) : null,
        }
      : {
          id: "",
          nomeFantasia: "Konext",
          logoUrl: null,
        },
  };
}

export async function atualizarPerfil(
  data: DadosPerfil
): Promise<ResultadoAcaoPerfil> {
  // Exige contexto tenant valido antes de alterar perfil.
  try {
    const contextoTenant = await exigirContextoTenant();
    const prismaTenant = contextoTenant.prisma as PrismaConfiguracoesClient;
    const usuarioDelegate = prismaTenant.usuario ?? prismaTenant.Usuario;

    if (!usuarioDelegate?.findFirst || !usuarioDelegate?.update) {
      return {
        sucesso: false,
        erro: "Nao foi possivel acessar os dados de usuario.",
      };
    }

    const fotoPerfilNormalizada = normalizarUrlImagem(data.fotoPerfilUrl, "URL da foto de perfil");

    // F-03 (IDOR): o alvo é SEMPRE o usuário da própria sessão. Um `usuarioId`
    // vindo do cliente permitia renomear/reatribuir e-mail de qualquer outro
    // usuário do tenant — removido de propósito, não é mais um parâmetro.
    let usuarioAlvo = null;

    if (contextoTenant.usuarioOperacional.id && usuarioDelegate.findUnique) {
      usuarioAlvo = await usuarioDelegate.findUnique({
        where: { id: contextoTenant.usuarioOperacional.id },
      });
    }

    if (!usuarioAlvo) {
      // Nao inventa Usuario operacional: sessao central sem mapeamento local nao edita perfil operacional.
      return {
        sucesso: false,
        erro: "Nenhum usuario operacional correspondente encontrado neste tenant.",
      };
    }

    const usuarioAtualizado = await usuarioDelegate.update({
      where: {
        id: usuarioAlvo.id,
      },
      data: {
        nome: data.nome?.trim() || usuarioAlvo.nome,
        email: data.email?.trim() || usuarioAlvo.email,
        fotoPerfilUrl: fotoPerfilNormalizada,
      },
    });

    revalidatePath("/perfil");
    revalidatePath("/", "layout");

    return {
      sucesso: true,
      id: String(usuarioAtualizado.id),
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: paraMensagemSegura(error),
    };
  }
}

export async function atualizarLogoEmpresa(
  logoUrl: string,
  nomeFantasia?: string
): Promise<ResultadoAcaoPerfil> {
  // Exige contexto tenant valido antes de alterar a logo da empresa.
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "configuracoes.empresa");
    const prismaTenant = contextoTenant.prisma as PrismaConfiguracoesClient;
    const configuracaoDelegate = prismaTenant.configuracao ?? prismaTenant.Configuracao;

    if (!configuracaoDelegate?.findFirst || !configuracaoDelegate?.update) {
      return {
        sucesso: false,
        erro: "Nao foi possivel acessar as configuracoes da empresa.",
      };
    }

    const logoUrlNormalizada = normalizarUrlImagem(logoUrl, "URL da logo da empresa");

    // F-03 (IDOR): a Configuracao alvo é SEMPRE a linha única do tenant (é
    // singleton, ver F-31), nunca um id vindo do cliente.
    let configuracaoAlvo = await configuracaoDelegate.findFirst({
      select: SELECAO_DE_CONFIGURACAO,
      orderBy: {
        criadoEm: "asc",
      },
    });

    if (!configuracaoAlvo) {
      if (!configuracaoDelegate.create) {
        return {
          sucesso: false,
          erro: "Nao foi possivel criar configuracao padrao da empresa.",
        };
      }

      configuracaoAlvo = await configuracaoDelegate.create({
        select: SELECAO_DE_CONFIGURACAO,
        data: {
          nomeFantasia: nomeFantasia?.trim() || "Konext",
          logoUrl: logoUrlNormalizada,
        },
      });
    }

    await configuracaoDelegate.update({
      select: SELECAO_SO_O_ID,
      where: {
        id: configuracaoAlvo.id,
      },
      data: {
        logoUrl: logoUrlNormalizada,
        ...(nomeFantasia ? { nomeFantasia: nomeFantasia.trim() } : {}),
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/perfil");

    return {
      sucesso: true,
      id: String(configuracaoAlvo.id),
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: paraMensagemSegura(error),
    };
  }
}

async function lerCamposPdvViaSql(
  prismaClient: PrismaOperacionalTenant,
  id: string
): Promise<CamposPdvRaw | null> {
  if (!id) return null;
  try {
    const rows = await prismaClient.$queryRaw<Array<CamposPdvRaw>>`
      SELECT
        "permitirPagamentoMisto",
        "permitirDescontoPDV",
        "descontoMaximoPDVPercentual",
        "permitirVendaFiado",
        "habilitarPix",
        "habilitarDinheiro",
        "habilitarCartaoDebito",
        "habilitarCartaoCredito",
        "habilitarBoleto",
        "habilitarCrediario",
        "taxaCartaoDebitoPercentual",
        "taxaCartaoCredito1xPercentual",
        "taxaCartaoCredito2xPercentual",
        "taxaCartaoCredito3xPercentual",
        "taxaCartaoCredito4xPercentual",
        "taxaCartaoCredito5xPercentual",
        "taxaCartaoCredito6xPercentual",
        "taxaCartaoCredito7xPercentual",
        "taxaCartaoCredito8xPercentual",
        "taxaCartaoCredito9xPercentual",
        "taxaCartaoCredito10xPercentual",
        "taxaCartaoCredito11xPercentual",
        "taxaCartaoCredito12xPercentual",
        "prazoPadraoBoletoDias",
        "prazoPadraoCrediarioDias",
        "maxParcelasCartaoCredito"
      FROM "Configuracao"
      WHERE id = ${id}
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
