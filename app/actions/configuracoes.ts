"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import {
  obterDefaultsConfiguracaoOsGarantias,
  TEXTO_COBERTURA_GARANTIA_PADRAO,
  TEXTO_EXCLUSOES_GARANTIA_PADRAO,
  TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
} from "@/lib/configuracoes-os-garantias";

type ConfiguracaoRegistro = {
  id: string;
  criadoEm?: Date;
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
  chavePix?: string | null;
  mensagemCupom?: string | null;
  habilitarMargemAutomatica?: boolean | null;
  permitirVendaSemEstoque?: boolean | null;
  logoUrl?: string | null;
  prazoGarantiaPadraoDias?: number | null;
  prazoMinimoGarantiaDias?: number | null;
  prazoMaximoGarantiaDias?: number | null;
  exigirGarantiaAntesEntrega?: boolean | null;
  exigirItemParaGarantia?: boolean | null;
  exigirItemParaEnviarPDV?: boolean | null;
  exigirDiagnosticoParaFinalizar?: boolean | null;
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

type PrismaConfiguracoesClient = typeof prisma & {
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
  chavePix: string;
  mensagemCupom: string;
  habilitarMargemAutomatica: boolean;
  permitirVendaSemEstoque: boolean;
  logoUrl: string;
  prazoGarantiaPadraoDias: number;
  prazoMinimoGarantiaDias: number;
  prazoMaximoGarantiaDias: number;
  exigirGarantiaAntesEntrega: boolean;
  exigirItemParaGarantia: boolean;
  exigirItemParaEnviarPDV: boolean;
  exigirDiagnosticoParaFinalizar: boolean;
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
  chavePix: z.string().trim().max(160, "Chave PIX excede o limite de 160 caracteres."),
  mensagemCupom: z.string().trim().max(1000, "Mensagem do cupom excede o limite de 1000 caracteres."),
  habilitarMargemAutomatica: z.boolean(),
  permitirVendaSemEstoque: z.boolean(),
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

function obterDelegateConfiguracao() {
  const prismaAny = prisma as PrismaConfiguracoesClient;
  return prismaAny.configuracao ?? prismaAny.Configuracao;
}

function obterConfiguracoesPadrao(): DadosConfiguracoes {
  const defaultsOsGarantias = obterDefaultsConfiguracaoOsGarantias();

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
    chavePix: "",
    mensagemCupom: "",
    habilitarMargemAutomatica: true,
    permitirVendaSemEstoque: false,
    logoUrl: "",
    prazoGarantiaPadraoDias: defaultsOsGarantias.prazoGarantiaPadraoDias,
    prazoMinimoGarantiaDias: defaultsOsGarantias.prazoMinimoGarantiaDias,
    prazoMaximoGarantiaDias: defaultsOsGarantias.prazoMaximoGarantiaDias,
    exigirGarantiaAntesEntrega: defaultsOsGarantias.exigirGarantiaAntesEntrega,
    exigirItemParaGarantia: defaultsOsGarantias.exigirItemParaGarantia,
    exigirItemParaEnviarPDV: defaultsOsGarantias.exigirItemParaEnviarPDV,
    exigirDiagnosticoParaFinalizar: defaultsOsGarantias.exigirDiagnosticoParaFinalizar,
    permitirFinalizarSemPagamento: defaultsOsGarantias.permitirFinalizarSemPagamento,
    permitirGarantiaPersonalizada: defaultsOsGarantias.permitirGarantiaPersonalizada,
    textoCoberturaGarantia: defaultsOsGarantias.textoCoberturaGarantia,
    textoExclusoesGarantia: defaultsOsGarantias.textoExclusoesGarantia,
    textoResponsabilidadeDados: defaultsOsGarantias.textoResponsabilidadeDados,
  };
}

function normalizarConfiguracoesEntrada(data: DadosConfiguracoes): DadosConfiguracoes {
  const resultado = schemaDadosConfiguracoes.safeParse(data);

  if (!resultado.success) {
    throw new Error(resultado.error.issues[0]?.message ?? "Dados de configuração inválidos.");
  }

  return {
    ...resultado.data,
    nomeFantasia: resultado.data.nomeFantasia || "Konext",
    estado: resultado.data.estado.toUpperCase(),
    logoUrl: normalizarUrlImagem(resultado.data.logoUrl, "URL da logo da empresa") ?? "",
    textoCoberturaGarantia: resultado.data.textoCoberturaGarantia || TEXTO_COBERTURA_GARANTIA_PADRAO,
    textoExclusoesGarantia: resultado.data.textoExclusoesGarantia || TEXTO_EXCLUSOES_GARANTIA_PADRAO,
    textoResponsabilidadeDados:
      resultado.data.textoResponsabilidadeDados || TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
  };
}

export async function obterConfiguracoes() {
  const configuracaoDelegate = obterDelegateConfiguracao();

  if (!configuracaoDelegate?.findFirst) {
    return {
      id: "",
      ...obterConfiguracoesPadrao(),
    };
  }

  let configuracao = await configuracaoDelegate.findFirst({
    orderBy: {
      criadoEm: "asc",
    },
  });

  if (!configuracao && configuracaoDelegate.create) {
    try {
      configuracao = await configuracaoDelegate.create({
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
          chavePix: null,
          mensagemCupom: null,
          habilitarMargemAutomatica: true,
          permitirVendaSemEstoque: false,
          logoUrl: null,
          prazoGarantiaPadraoDias: 90,
          prazoMinimoGarantiaDias: 1,
          prazoMaximoGarantiaDias: 365,
          exigirGarantiaAntesEntrega: true,
          exigirItemParaGarantia: true,
          exigirItemParaEnviarPDV: true,
          exigirDiagnosticoParaFinalizar: false,
          permitirFinalizarSemPagamento: true,
          permitirGarantiaPersonalizada: true,
          textoCoberturaGarantia: TEXTO_COBERTURA_GARANTIA_PADRAO,
          textoExclusoesGarantia: TEXTO_EXCLUSOES_GARANTIA_PADRAO,
          textoResponsabilidadeDados: TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
        },
      });
    } catch {
      configuracao = await configuracaoDelegate.findFirst({
        orderBy: {
          criadoEm: "asc",
        },
      });
    }
  }

  const defaults = obterConfiguracoesPadrao();

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
    chavePix: configuracao?.chavePix ? String(configuracao.chavePix) : "",
    mensagemCupom: configuracao?.mensagemCupom ? String(configuracao.mensagemCupom) : "",
    habilitarMargemAutomatica:
      typeof configuracao?.habilitarMargemAutomatica === "boolean"
        ? Boolean(configuracao.habilitarMargemAutomatica)
        : true,
    permitirVendaSemEstoque:
      typeof configuracao?.permitirVendaSemEstoque === "boolean"
        ? Boolean(configuracao.permitirVendaSemEstoque)
        : false,
    logoUrl: configuracao?.logoUrl ? String(configuracao.logoUrl) : "",
    prazoGarantiaPadraoDias:
      typeof configuracao?.prazoGarantiaPadraoDias === "number"
        ? Number(configuracao.prazoGarantiaPadraoDias)
        : defaults.prazoGarantiaPadraoDias,
    prazoMinimoGarantiaDias:
      typeof configuracao?.prazoMinimoGarantiaDias === "number"
        ? Number(configuracao.prazoMinimoGarantiaDias)
        : defaults.prazoMinimoGarantiaDias,
    prazoMaximoGarantiaDias:
      typeof configuracao?.prazoMaximoGarantiaDias === "number"
        ? Number(configuracao.prazoMaximoGarantiaDias)
        : defaults.prazoMaximoGarantiaDias,
    exigirGarantiaAntesEntrega:
      typeof configuracao?.exigirGarantiaAntesEntrega === "boolean"
        ? Boolean(configuracao.exigirGarantiaAntesEntrega)
        : defaults.exigirGarantiaAntesEntrega,
    exigirItemParaGarantia:
      typeof configuracao?.exigirItemParaGarantia === "boolean"
        ? Boolean(configuracao.exigirItemParaGarantia)
        : defaults.exigirItemParaGarantia,
    exigirItemParaEnviarPDV:
      typeof configuracao?.exigirItemParaEnviarPDV === "boolean"
        ? Boolean(configuracao.exigirItemParaEnviarPDV)
        : defaults.exigirItemParaEnviarPDV,
    exigirDiagnosticoParaFinalizar:
      typeof configuracao?.exigirDiagnosticoParaFinalizar === "boolean"
        ? Boolean(configuracao.exigirDiagnosticoParaFinalizar)
        : defaults.exigirDiagnosticoParaFinalizar,
    permitirFinalizarSemPagamento:
      typeof configuracao?.permitirFinalizarSemPagamento === "boolean"
        ? Boolean(configuracao.permitirFinalizarSemPagamento)
        : defaults.permitirFinalizarSemPagamento,
    permitirGarantiaPersonalizada:
      typeof configuracao?.permitirGarantiaPersonalizada === "boolean"
        ? Boolean(configuracao.permitirGarantiaPersonalizada)
        : defaults.permitirGarantiaPersonalizada,
    textoCoberturaGarantia: configuracao?.textoCoberturaGarantia
      ? String(configuracao.textoCoberturaGarantia)
      : defaults.textoCoberturaGarantia,
    textoExclusoesGarantia: configuracao?.textoExclusoesGarantia
      ? String(configuracao.textoExclusoesGarantia)
      : defaults.textoExclusoesGarantia,
    textoResponsabilidadeDados: configuracao?.textoResponsabilidadeDados
      ? String(configuracao.textoResponsabilidadeDados)
      : defaults.textoResponsabilidadeDados,
  };
}

export async function salvarConfiguracoes(data: DadosConfiguracoes) {
  // C1: exige sessao valida antes de alterar configuracoes da empresa.
  const usuario = await exigirSessao();

  const dadosNormalizados = normalizarConfiguracoesEntrada(data);

  const configuracaoDelegate = obterDelegateConfiguracao();

  if (!configuracaoDelegate?.findFirst || !configuracaoDelegate?.update) {
    throw new Error("Delegate Prisma de Configuracao nao disponivel.");
  }

  let configuracao = await configuracaoDelegate.findFirst({
    orderBy: {
      criadoEm: "asc",
    },
  });

  if (!configuracao && configuracaoDelegate.create) {
    configuracao = await configuracaoDelegate.create({
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
        chavePix: null,
        mensagemCupom: null,
        habilitarMargemAutomatica: true,
        permitirVendaSemEstoque: false,
        logoUrl: null,
        prazoGarantiaPadraoDias: 90,
        prazoMinimoGarantiaDias: 1,
        prazoMaximoGarantiaDias: 365,
        exigirGarantiaAntesEntrega: true,
        exigirItemParaGarantia: true,
        exigirItemParaEnviarPDV: true,
        exigirDiagnosticoParaFinalizar: false,
        permitirFinalizarSemPagamento: true,
        permitirGarantiaPersonalizada: true,
        textoCoberturaGarantia: TEXTO_COBERTURA_GARANTIA_PADRAO,
        textoExclusoesGarantia: TEXTO_EXCLUSOES_GARANTIA_PADRAO,
        textoResponsabilidadeDados: TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
      },
    });
  }

  if (!configuracao) {
    throw new Error("Nao foi possivel inicializar as configuracoes do sistema.");
  }

  const dadosAntes = await obterConfiguracoes();

  await configuracaoDelegate.update({
    where: {
      id: configuracao.id,
    },
    data: {
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
      chavePix: dadosNormalizados.chavePix || null,
      mensagemCupom: dadosNormalizados.mensagemCupom || null,
      habilitarMargemAutomatica: dadosNormalizados.habilitarMargemAutomatica,
      permitirVendaSemEstoque: dadosNormalizados.permitirVendaSemEstoque,
      logoUrl: dadosNormalizados.logoUrl || null,
      prazoGarantiaPadraoDias: dadosNormalizados.prazoGarantiaPadraoDias,
      prazoMinimoGarantiaDias: dadosNormalizados.prazoMinimoGarantiaDias,
      prazoMaximoGarantiaDias: dadosNormalizados.prazoMaximoGarantiaDias,
      exigirGarantiaAntesEntrega: dadosNormalizados.exigirGarantiaAntesEntrega,
      exigirItemParaGarantia: dadosNormalizados.exigirItemParaGarantia,
      exigirItemParaEnviarPDV: dadosNormalizados.exigirItemParaEnviarPDV,
      exigirDiagnosticoParaFinalizar: dadosNormalizados.exigirDiagnosticoParaFinalizar,
      permitirFinalizarSemPagamento: dadosNormalizados.permitirFinalizarSemPagamento,
      permitirGarantiaPersonalizada: dadosNormalizados.permitirGarantiaPersonalizada,
      textoCoberturaGarantia: dadosNormalizados.textoCoberturaGarantia || null,
      textoExclusoesGarantia: dadosNormalizados.textoExclusoesGarantia || null,
      textoResponsabilidadeDados: dadosNormalizados.textoResponsabilidadeDados || null,
    },
  });

  await registrarLogAuditoria(
    prisma,
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
        permitirFinalizarSemPagamento: dadosAntes.permitirFinalizarSemPagamento,
        permitirGarantiaPersonalizada: dadosAntes.permitirGarantiaPersonalizada,
        habilitarMargemAutomatica: dadosAntes.habilitarMargemAutomatica,
      },
      dadosDepois: {
        prazoGarantiaPadraoDias: dadosNormalizados.prazoGarantiaPadraoDias,
        prazoMinimoGarantiaDias: dadosNormalizados.prazoMinimoGarantiaDias,
        prazoMaximoGarantiaDias: dadosNormalizados.prazoMaximoGarantiaDias,
        exigirGarantiaAntesEntrega: dadosNormalizados.exigirGarantiaAntesEntrega,
        exigirItemParaGarantia: dadosNormalizados.exigirItemParaGarantia,
        exigirItemParaEnviarPDV: dadosNormalizados.exigirItemParaEnviarPDV,
        exigirDiagnosticoParaFinalizar: dadosNormalizados.exigirDiagnosticoParaFinalizar,
        permitirFinalizarSemPagamento: dadosNormalizados.permitirFinalizarSemPagamento,
        permitirGarantiaPersonalizada: dadosNormalizados.permitirGarantiaPersonalizada,
        habilitarMargemAutomatica: dadosNormalizados.habilitarMargemAutomatica,
      },
    }
  );

  revalidatePath("/configuracoes");
  revalidatePath("/os");
  revalidatePath("/os/garantias");
  revalidatePath("/dashboard");
  revalidatePath("/crm/propostas");
  revalidatePath("/vendas/historico");
  revalidatePath("/", "layout");
}

export async function consultarCnpjReceita(cnpj: string): Promise<ResultadoConsultaCnpj> {
  const cnpjLimpo = String(cnpj ?? "").replace(/\D/g, "");

  if (cnpjLimpo.length !== 14) {
    return {
      sucesso: false,
      erro: "CNPJ inválido.",
    };
  }

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!resposta.ok) {
      return {
        sucesso: false,
        erro: "CNPJ não encontrado na Receita.",
      };
    }

    const payload = await resposta.json();
    const cepNumerico = String(payload?.cep ?? "").replace(/\D/g, "");

    return {
      sucesso: true,
      dados: {
        razaoSocial: String(payload?.razao_social ?? ""),
        cep: cepNumerico,
        logradouro: String(payload?.logradouro ?? ""),
        numero: String(payload?.numero ?? ""),
        bairro: String(payload?.bairro ?? ""),
        cidade: String(payload?.municipio ?? ""),
        estado: String(payload?.uf ?? ""),
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
  const prismaAny = prisma as PrismaConfiguracoesClient;
  const usuarioDelegate = prismaAny.usuario ?? prismaAny.Usuario;
  const configuracaoDelegate = prismaAny.configuracao ?? prismaAny.Configuracao;

  if (!usuarioDelegate?.findFirst || !configuracaoDelegate?.findFirst) {
    return {
      usuario: {
        id: "",
        nome: "Usuario Konext",
        email: "usuario@konext.local",
        fotoPerfilUrl: null,
        role: "ADMIN",
      },
      configuracao: {
        id: "",
        nomeFantasia: "Konext",
        logoUrl: null,
      },
    };
  }

  let usuario = await usuarioDelegate.findFirst({
    orderBy: {
      criadoEm: "asc",
    },
  });

  if (!usuario && usuarioDelegate.upsert) {
    usuario = await usuarioDelegate.upsert({
      where: {
        email: "usuario@konext.local",
      },
      update: {},
      create: {
        nome: "Usuario Konext",
        email: "usuario@konext.local",
        senha: "pendente",
        role: "ADMIN",
      },
    });
  }

  if (!usuario && usuarioDelegate.create) {
    try {
      usuario = await usuarioDelegate.create({
        data: {
          nome: "Usuario Konext",
          email: "usuario@konext.local",
          senha: "pendente",
          role: "ADMIN",
        },
      });
    } catch {
      usuario = await usuarioDelegate.findFirst({
        orderBy: {
          criadoEm: "asc",
        },
      });
    }
  }

  let configuracao = await configuracaoDelegate.findFirst({
    orderBy: {
      criadoEm: "asc",
    },
  });

  if (!configuracao && configuracaoDelegate.create) {
    try {
      configuracao = await configuracaoDelegate.create({
        data: {
          nomeFantasia: "Konext",
          logoUrl: null,
        },
      });
    } catch {
      configuracao = await configuracaoDelegate.findFirst({
        orderBy: {
          criadoEm: "asc",
        },
      });
    }
  }

  return {
    usuario: usuario
      ? {
          id: String(usuario.id),
          nome: String(usuario.nome),
          email: String(usuario.email),
          fotoPerfilUrl: usuario.fotoPerfilUrl ? String(usuario.fotoPerfilUrl) : null,
          role: String(usuario.role),
        }
      : {
          id: "",
          nome: "Usuario Konext",
          email: "usuario@konext.local",
          fotoPerfilUrl: null,
          role: "ADMIN",
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
  usuarioId: string | null,
  data: DadosPerfil
): Promise<ResultadoAcaoPerfil> {
  // C1: exige sessao valida antes de alterar perfil.
  try {
    await exigirSessao();

    const prismaAny = prisma as PrismaConfiguracoesClient;
    const usuarioDelegate = prismaAny.usuario ?? prismaAny.Usuario;

    if (!usuarioDelegate?.findFirst || !usuarioDelegate?.update) {
      return {
        sucesso: false,
        erro: "Nao foi possivel acessar os dados de usuario.",
      };
    }

    const fotoPerfilNormalizada = normalizarUrlImagem(data.fotoPerfilUrl, "URL da foto de perfil");

    let usuarioAlvo = null;

    if (usuarioId && usuarioDelegate.findUnique) {
      usuarioAlvo = await usuarioDelegate.findUnique({ where: { id: usuarioId } });
    }

    if (!usuarioAlvo) {
      usuarioAlvo = await usuarioDelegate.findFirst({
        orderBy: {
          criadoEm: "asc",
        },
      });
    }

    if (!usuarioAlvo) {
      if (!usuarioDelegate.create) {
        return {
          sucesso: false,
          erro: "Nao foi possivel criar usuario padrao para atualizacao de perfil.",
        };
      }

      usuarioAlvo = await usuarioDelegate.create({
        data: {
          nome: data.nome?.trim() || "Usuario Konext",
          email: data.email?.trim() || `usuario-${Date.now()}@konext.local`,
          senha: "pendente",
          role: "ADMIN",
          fotoPerfilUrl: fotoPerfilNormalizada,
        },
      });
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
    const mensagem = error instanceof Error ? error.message : "Nao foi possivel salvar os dados do perfil.";
    return {
      sucesso: false,
      erro: mensagem,
    };
  }
}

export async function atualizarLogoEmpresa(
  configId: string | null,
  logoUrl: string,
  nomeFantasia?: string
): Promise<ResultadoAcaoPerfil> {
  // C1: exige sessao valida antes de alterar a logo da empresa.
  try {
    await exigirSessao();

    const prismaAny = prisma as PrismaConfiguracoesClient;
    const configuracaoDelegate = prismaAny.configuracao ?? prismaAny.Configuracao;

    if (!configuracaoDelegate?.findFirst || !configuracaoDelegate?.update) {
      return {
        sucesso: false,
        erro: "Nao foi possivel acessar as configuracoes da empresa.",
      };
    }

    const logoUrlNormalizada = normalizarUrlImagem(logoUrl, "URL da logo da empresa");

    let configuracaoAlvo = null;

    if (configId && configuracaoDelegate.findUnique) {
      configuracaoAlvo = await configuracaoDelegate.findUnique({ where: { id: configId } });
    }

    if (!configuracaoAlvo) {
      configuracaoAlvo = await configuracaoDelegate.findFirst({
        orderBy: {
          criadoEm: "asc",
        },
      });
    }

    if (!configuracaoAlvo) {
      if (!configuracaoDelegate.create) {
        return {
          sucesso: false,
          erro: "Nao foi possivel criar configuracao padrao da empresa.",
        };
      }

      configuracaoAlvo = await configuracaoDelegate.create({
        data: {
          nomeFantasia: nomeFantasia?.trim() || "Konext",
          logoUrl: logoUrlNormalizada,
        },
      });
    }

    await configuracaoDelegate.update({
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
    const mensagem = error instanceof Error ? error.message : "Nao foi possivel salvar a logo da empresa.";
    return {
      sucesso: false,
      erro: mensagem,
    };
  }
}