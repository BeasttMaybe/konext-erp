"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { formClienteSchema, type FormCliente } from "@/lib/validations/crm";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { mensagemDeErroConhecido } from "@/lib/erros";
import { ID_CLIENTE_CONSUMIDOR_FINAL, podeEditarCliente, podeExcluirCliente } from "@/lib/dominio/crm/consumidor-final";

type ResultadoCriarCliente =
  | {
      sucesso: true;
      mensagem: string;
      cliente: {
        id: string;
        tipoPessoa: "FISICA" | "JURIDICA";
        nomeRazaoSocial: string;
        nomeFantasia: string | null;
        /** Nulo quando o cliente nao informou CPF/CNPJ. */
        documento: string | null;
        inscricaoEstadual: string | null;
        email: string | null;
        telefone: string;
        isWhatsapp: boolean;
        cep: string | null;
        logradouro: string | null;
        numero: string | null;
        bairro: string | null;
        cidade: string | null;
        estado: string | null;
        papel: "CLIENTE" | "FORNECEDOR";
        categoria: "CLIENTE_FINAL" | "EMPRESA" | "ORGAO_PUBLICO";
        observacoes: string | null;
      };
    }
  | {
      sucesso: false;
      mensagem: string;
    };

type ResultadoConsultaCnpjCliente =
  | {
      sucesso: true;
      dados: {
        nomeRazaoSocial: string;
        nomeFantasia: string;
        /** Nulo quando o cliente nao informou CPF/CNPJ. */
        documento: string | null;
        cep: string;
        logradouro: string;
        numero: string;
        bairro: string;
        cidade: string;
        estado: string;
        telefone: string;
        inscricaoEstadual: string;
      };
    }
  | {
      sucesso: false;
      mensagem: string;
    };

export async function consultarCnpjReceitaCliente(
  cnpj: string
): Promise<ResultadoConsultaCnpjCliente> {
  // Sem isso, esta action era um proxy externo alcancavel sem sessao
  // (qualquer chamada POST ao endpoint do Server Action, autenticado ou nao).
  const contextoTenant = await exigirContextoTenant();
  exigirPermissao(contextoTenant, "crm.editar");

  const cnpjLimpo = String(cnpj ?? "").replace(/\D/g, "");

  if (cnpjLimpo.length !== 14) {
    return {
      sucesso: false,
      mensagem: "CNPJ invalido.",
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

    if (resposta.ok) {
      const payload = (await resposta.json()) as {
        razao_social?: string;
        nome_fantasia?: string;
        cep?: string;
        logradouro?: string;
        numero?: string;
        bairro?: string;
        municipio?: string;
        uf?: string;
        ddd_telefone_1?: string;
        inscricoes_estaduais?: Array<{
          inscricao_estadual?: string;
        }>;
      };

      const cepNumerico = String(payload.cep ?? "").replace(/\D/g, "");
      const telefoneNumerico = String(payload.ddd_telefone_1 ?? "").replace(/\D/g, "");
      const inscricaoEstadual = payload.inscricoes_estaduais?.[0]?.inscricao_estadual ?? "";

      return {
        sucesso: true,
        dados: {
          nomeRazaoSocial: String(payload.razao_social ?? ""),
          nomeFantasia: String(payload.nome_fantasia ?? ""),
          documento: cnpjLimpo,
          cep: cepNumerico,
          logradouro: String(payload.logradouro ?? ""),
          numero: String(payload.numero ?? ""),
          bairro: String(payload.bairro ?? ""),
          cidade: String(payload.municipio ?? ""),
          estado: String(payload.uf ?? "").toUpperCase(),
          telefone: telefoneNumerico,
          inscricaoEstadual: String(inscricaoEstadual ?? ""),
        },
      };
    }

    const respostaFallback = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!respostaFallback.ok) {
      return {
        sucesso: false,
        mensagem: "CNPJ nao encontrado na Receita.",
      };
    }

    const payloadFallback = (await respostaFallback.json()) as {
      razao_social?: string;
      estabelecimento?: {
        nome_fantasia?: string | null;
        cep?: string;
        logradouro?: string;
        numero?: string;
        bairro?: string;
        cidade?: {
          nome?: string;
        };
        estado?: {
          sigla?: string;
        };
        ddd1?: string | null;
        telefone1?: string | null;
        inscricoes_estaduais?: Array<{
          inscricao_estadual?: string;
        }>;
      };
    };

    const estabelecimento = payloadFallback.estabelecimento;
    const telefoneFallback = `${String(estabelecimento?.ddd1 ?? "")}${String(estabelecimento?.telefone1 ?? "")}`.replace(/\D/g, "");
    const cepFallback = String(estabelecimento?.cep ?? "").replace(/\D/g, "");
    const inscricaoFallback = estabelecimento?.inscricoes_estaduais?.[0]?.inscricao_estadual ?? "";

    return {
      sucesso: true,
      dados: {
        nomeRazaoSocial: String(payloadFallback.razao_social ?? ""),
        nomeFantasia: String(estabelecimento?.nome_fantasia ?? ""),
        documento: cnpjLimpo,
        cep: cepFallback,
        logradouro: String(estabelecimento?.logradouro ?? ""),
        numero: String(estabelecimento?.numero ?? ""),
        bairro: String(estabelecimento?.bairro ?? ""),
        cidade: String(estabelecimento?.cidade?.nome ?? ""),
        estado: String(estabelecimento?.estado?.sigla ?? "").toUpperCase(),
        telefone: telefoneFallback,
        inscricaoEstadual: String(inscricaoFallback ?? ""),
      },
    };
  } catch {
    return {
      sucesso: false,
      mensagem: "Nao foi possivel consultar o CNPJ agora.",
    };
  }
}

export async function criarCliente(
  data: FormCliente
): Promise<ResultadoCriarCliente> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.editar");
    const prisma = contextoTenant.prisma;
    const dadosValidados = formClienteSchema.parse(data);
    const papelNormalizado = dadosValidados.papel;
    const categoriaNormalizada =
      papelNormalizado === "FORNECEDOR"
        ? "EMPRESA"
        : dadosValidados.tipoPessoa === "JURIDICA" && dadosValidados.categoria === "CLIENTE_FINAL"
        ? "EMPRESA"
        : dadosValidados.categoria;

    const payload: Prisma.ClienteCreateInput = {
      tipoPessoa: dadosValidados.tipoPessoa,
      papel: papelNormalizado,
      nomeRazaoSocial: dadosValidados.nomeRazaoSocial.trim(),
      nomeFantasia: dadosValidados.nomeFantasia?.trim() || null,
      // NULO quando vazio, nunca "": a coluna e unica, e varias
      // strings vazias colidiriam no segundo cliente sem documento.
      documento: dadosValidados.documento?.trim() || null,
      inscricaoEstadual: dadosValidados.inscricaoEstadual?.trim() || null,
      email: dadosValidados.email?.trim() || null,
      telefone: dadosValidados.telefone.trim(),
      isWhatsapp: dadosValidados.isWhatsapp,
      cep: dadosValidados.cep?.trim() || null,
      logradouro: dadosValidados.logradouro?.trim() || null,
      numero: dadosValidados.numero?.trim() || null,
      bairro: dadosValidados.bairro?.trim() || null,
      cidade: dadosValidados.cidade?.trim() || null,
      estado: dadosValidados.estado?.trim()?.toUpperCase() || null,
      categoria: categoriaNormalizada,
      observacoes: dadosValidados.observacoes?.trim() || null,
    };

    const cliente = await prisma.cliente.create({ data: payload });

    revalidatePath("/crm");

    return {
      sucesso: true,
      mensagem: "Cliente cadastrado com sucesso!",
      cliente: {
        id: cliente.id,
        tipoPessoa: cliente.tipoPessoa,
        nomeRazaoSocial: cliente.nomeRazaoSocial,
        nomeFantasia: cliente.nomeFantasia,
        documento: cliente.documento ?? "",
        inscricaoEstadual: cliente.inscricaoEstadual,
        email: cliente.email,
        telefone: cliente.telefone,
        isWhatsapp: cliente.isWhatsapp,
        cep: cliente.cep,
        logradouro: cliente.logradouro,
        numero: cliente.numero,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        papel: cliente.papel,
        categoria: cliente.categoria,
        observacoes: cliente.observacoes,
      },
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    if (erro instanceof ZodError) {
      return {
        sucesso: false,
        mensagem:
          erro.issues[0]?.message || "Dados inválidos para cadastro do cliente.",
      };
    }

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      return {
        sucesso: false,
        mensagem: "Já existe um cliente com este CPF/CNPJ.",
      };
    }

    console.error("Erro ao criar cliente:", erro);

    return {
      sucesso: false,
      mensagem: "Não foi possível cadastrar o cliente. Tente novamente.",
    };
  }
}

export async function excluirCliente(
  clienteId: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.excluir");

    const invariante = podeExcluirCliente(clienteId);
    if (!invariante.permitido) {
      return { sucesso: false, mensagem: invariante.motivo ?? "Não é possível excluir este cliente." };
    }

    const prisma = contextoTenant.prisma;
    await prisma.cliente.delete({
      where: { id: clienteId },
    });

    revalidatePath("/crm");

    return {
      sucesso: true,
      mensagem: "Cliente excluido com sucesso.",
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2025"
    ) {
      return {
        sucesso: false,
        mensagem: "Cliente nao encontrado.",
      };
    }

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      (erro.code === "P2003" || erro.code === "P2014")
    ) {
      // Erro de chave estrangeira: cliente possui registros vinculados (OS, vendas, etc.)
      console.error("Erro FK ao excluir cliente:", erro.code, erro.meta);
      return {
        sucesso: false,
        mensagem:
          "Não é possível excluir este cliente pois ele possui Ordens de Serviço ou outros registros vinculados.",
      };
    }

    console.error("Erro ao excluir cliente:", erro);

    return {
      sucesso: false,
      mensagem: "Não foi possível excluir o cliente. Tente novamente.",
    };
  }
}

// ── Atualizar Cliente ───────────────────────────────────────────────────────────

export async function atualizarCliente(
  clienteId: string,
  dados: FormCliente
): Promise<ResultadoCriarCliente> {
  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.editar");

    const invariante = podeEditarCliente(clienteId);
    if (!invariante.permitido) {
      return { sucesso: false, mensagem: invariante.motivo ?? "Não é possível editar este cliente." };
    }

    const prisma = contextoTenant.prisma;
    const dadosValidados = formClienteSchema.parse(dados);
    const papelNormalizado = dadosValidados.papel;
    const categoriaNormalizada =
      papelNormalizado === "FORNECEDOR"
        ? "EMPRESA"
        : dadosValidados.tipoPessoa === "JURIDICA" && dadosValidados.categoria === "CLIENTE_FINAL"
          ? "EMPRESA"
          : dadosValidados.categoria;

    const clienteAtualizado = await prisma.cliente.update({
      where: { id: clienteId },
      data: {
        tipoPessoa: dadosValidados.tipoPessoa,
        papel: papelNormalizado,
        nomeRazaoSocial: dadosValidados.nomeRazaoSocial.trim(),
        nomeFantasia: dadosValidados.nomeFantasia?.trim() || null,
        // NULO quando vazio, nunca "": a coluna e unica, e varias
      // strings vazias colidiriam no segundo cliente sem documento.
      documento: dadosValidados.documento?.trim() || null,
        inscricaoEstadual: dadosValidados.inscricaoEstadual?.trim() || null,
        email: dadosValidados.email?.trim() || null,
        telefone: dadosValidados.telefone.trim(),
        isWhatsapp: dadosValidados.isWhatsapp,
        cep: dadosValidados.cep?.trim() || null,
        logradouro: dadosValidados.logradouro?.trim() || null,
        numero: dadosValidados.numero?.trim() || null,
        bairro: dadosValidados.bairro?.trim() || null,
        cidade: dadosValidados.cidade?.trim() || null,
        estado: dadosValidados.estado?.trim() || null,
        categoria: categoriaNormalizada,
        observacoes: dadosValidados.observacoes?.trim() || null,
      },
    });

    revalidatePath("/crm");

    return {
      sucesso: true,
      mensagem: "Cliente atualizado com sucesso.",
      cliente: {
        id: clienteAtualizado.id,
        tipoPessoa: clienteAtualizado.tipoPessoa,
        nomeRazaoSocial: clienteAtualizado.nomeRazaoSocial,
        nomeFantasia: clienteAtualizado.nomeFantasia,
        documento: clienteAtualizado.documento ?? "",
        inscricaoEstadual: clienteAtualizado.inscricaoEstadual,
        email: clienteAtualizado.email,
        telefone: clienteAtualizado.telefone,
        isWhatsapp: clienteAtualizado.isWhatsapp,
        cep: clienteAtualizado.cep,
        logradouro: clienteAtualizado.logradouro,
        numero: clienteAtualizado.numero,
        bairro: clienteAtualizado.bairro,
        cidade: clienteAtualizado.cidade,
        estado: clienteAtualizado.estado,
        papel: clienteAtualizado.papel,
        categoria: clienteAtualizado.categoria,
        observacoes: clienteAtualizado.observacoes,
      },
    };
  } catch (erro) {
    const mensagemConhecida = mensagemDeErroConhecido(erro);
    if (mensagemConhecida !== null) {
      return { sucesso: false, mensagem: mensagemConhecida };
    }
    if (erro instanceof ZodError) {
      return {
        sucesso: false,
        mensagem: erro.issues[0]?.message ?? "Dados inválidos.",
      };
    }
    console.error("Erro ao atualizar cliente:", erro);
    return { sucesso: false, mensagem: "Não foi possível atualizar o cliente." };
  }
}

export async function listarClientes() {
  const contextoTenant = await exigirContextoTenant();
  exigirPermissao(contextoTenant, "crm.ver");
  const prisma = contextoTenant.prisma;

  return prisma.cliente.findMany({
    where: {
      id: { not: ID_CLIENTE_CONSUMIDOR_FINAL },
    },
    orderBy: {
      nomeRazaoSocial: "asc",
    },
    select: {
      id: true,
      tipoPessoa: true,
      nomeRazaoSocial: true,
      nomeFantasia: true,
      documento: true,
      telefone: true,
      categoria: true,
    },
  });
}

// ── Paginação de Clientes ──────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  resumo: {
    total: number;
    clientes: number;
    fornecedores: number;
    empresas: number;
  };
}

type PapelFiltroContato = "CLIENTE" | "FORNECEDOR" | "TODOS";

function montarFiltroClientes(
  busca?: string,
  categoria?: string,
  papel?: PapelFiltroContato
): Prisma.ClienteWhereInput {
  // Consumidor Final e automatico do sistema: nunca aparece na lista do CRM
  // nem entra nas contagens de "clientes"/"fornecedores"/"empresas" abaixo
  // (todas derivadas deste mesmo where via prisma.cliente.count).
  const where: Prisma.ClienteWhereInput = { id: { not: ID_CLIENTE_CONSUMIDOR_FINAL } };

  if (categoria && categoria !== "TODOS") {
    where.categoria = categoria as "CLIENTE_FINAL" | "EMPRESA" | "ORGAO_PUBLICO";
  }

  if (papel && papel !== "TODOS") {
    where.papel = papel;
  }

  if (busca && busca.trim().length > 0) {
    const termo = busca.trim();
    where.OR = [
      { nomeRazaoSocial: { contains: termo, mode: "insensitive" } },
      { nomeFantasia: { contains: termo, mode: "insensitive" } },
      { documento: { contains: termo, mode: "insensitive" } },
      { telefone: { contains: termo, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listarClientesPaginado(
  page: number = 1,
  limit: number = 20,
  busca?: string,
  categoria?: string,
  papel?: PapelFiltroContato
): Promise<PaginatedResult<{
  id: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  papel: "CLIENTE" | "FORNECEDOR";
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  /** Nulo quando o cliente nao informou CPF/CNPJ. */
  documento: string | null;
  inscricaoEstadual: string | null;
  email: string | null;
  telefone: string;
  isWhatsapp: boolean;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  categoria: "CLIENTE_FINAL" | "EMPRESA" | "ORGAO_PUBLICO";
  observacoes: string | null;
}>> {
  const contextoTenant = await exigirContextoTenant();
  exigirPermissao(contextoTenant, "crm.ver");
  const prisma = contextoTenant.prisma;
  const skip = (page - 1) * limit;

  const where = montarFiltroClientes(busca, categoria, papel);

  const [total, clientes, totalEmpresas] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      orderBy: { nomeRazaoSocial: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        tipoPessoa: true,
        nomeRazaoSocial: true,
        nomeFantasia: true,
        documento: true,
        inscricaoEstadual: true,
        email: true,
        telefone: true,
        isWhatsapp: true,
        cep: true,
        logradouro: true,
        numero: true,
        bairro: true,
        cidade: true,
        estado: true,
        papel: true,
        categoria: true,
        observacoes: true,
      },
    }),
    // Conta PESSOA JURIDICA, e nao mais a etiqueta "categoria".
    //
    // O dono viu "Fornecedores 0" e "Empresas B2B 62" na mesma tela, com
    // pessoas fisicas de CPF entre as 62. A categoria era preenchida
    // automaticamente em varios caminhos (criar pela aba de fornecedores,
    // pessoa juridica marcada como cliente final...) e virou uma etiqueta
    // que ninguem escolheu e que contradizia o papel ao lado.
    //
    // `tipoPessoa` sai do proprio documento e nao e opiniao de ninguem.
    prisma.cliente.count({ where: { ...where, tipoPessoa: "JURIDICA" } }),
  ]);

  return {
    data: clientes,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    resumo: {
      total,
      clientes: papel === "FORNECEDOR" ? 0 : total,
      fornecedores: papel === "CLIENTE" ? 0 : total,
      empresas: totalEmpresas,
    },
  };
}

export interface ClienteBuscaCRM {
  id: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  /** Nulo quando o cliente nao informou CPF/CNPJ. */
  documento: string | null;
  telefone: string;
}

type PapelFiltroBuscaCRM = "CLIENTE" | "FORNECEDOR" | "TODOS";

export async function buscarClientesCRM(
  termo: string,
  papel: PapelFiltroBuscaCRM = "TODOS"
): Promise<ClienteBuscaCRM[]> {
  const termoNormalizado = termo.trim();
  if (termoNormalizado.length < 1) return [];

  try {
    const contextoTenant = await exigirContextoTenant();
    exigirPermissao(contextoTenant, "crm.ver");
    const prisma = contextoTenant.prisma;
    const apenasDigitos = termoNormalizado.replace(/\D/g, "");
    
    const whereConditions: Prisma.ClienteWhereInput[] = [
      {
        nomeRazaoSocial: {
          contains: termoNormalizado,
          mode: "insensitive",
        },
      },
    ];

    // Adiciona busca por nomeFantasia apenas se não for vazio
    if (termoNormalizado) {
      whereConditions.push({
        nomeFantasia: {
          contains: termoNormalizado,
          mode: "insensitive",
        },
      });
    }

    // Adiciona busca por documento
    if (apenasDigitos.length > 0) {
      whereConditions.push({
        documento: {
          contains: apenasDigitos,
        },
      });
    }

    const where: Prisma.ClienteWhereInput = {
      OR: whereConditions,
      id: { not: ID_CLIENTE_CONSUMIDOR_FINAL },
    };

    if (papel !== "TODOS") {
      where.papel = papel;
    }

    return await prisma.cliente.findMany({
      where,
      orderBy: {
        nomeRazaoSocial: "asc",
      },
      take: 20,
      select: {
        id: true,
        nomeRazaoSocial: true,
        nomeFantasia: true,
        documento: true,
        telefone: true,
      },
    });
  } catch (erro) {
    console.error("Erro ao buscar clientes:", erro);
    return [];
  }
}
