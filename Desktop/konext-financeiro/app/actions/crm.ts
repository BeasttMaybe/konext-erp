"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { formClienteSchema, type FormCliente } from "@/lib/validations/crm";
import { exigirSessao } from "@/lib/auth/sessao";

type ResultadoCriarCliente =
  | {
      sucesso: true;
      mensagem: string;
      cliente: {
        id: string;
        tipoPessoa: "FISICA" | "JURIDICA";
        nomeRazaoSocial: string;
        nomeFantasia: string | null;
        documento: string;
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
        documento: string;
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
    await exigirSessao();
    const dadosValidados = formClienteSchema.parse(data);
    const categoriaNormalizada =
      dadosValidados.tipoPessoa === "JURIDICA" && dadosValidados.categoria === "CLIENTE_FINAL"
        ? "EMPRESA"
        : dadosValidados.categoria;

    const payload: Prisma.ClienteCreateInput = {
      tipoPessoa: dadosValidados.tipoPessoa,
      nomeRazaoSocial: dadosValidados.nomeRazaoSocial.trim(),
      nomeFantasia: dadosValidados.nomeFantasia?.trim() || null,
      documento: dadosValidados.documento.trim(),
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
        documento: cliente.documento,
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
        categoria: cliente.categoria,
        observacoes: cliente.observacoes,
      },
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
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
    await exigirSessao();
    await prisma.cliente.delete({
      where: { id: clienteId },
    });

    revalidatePath("/crm");

    return {
      sucesso: true,
      mensagem: "Cliente excluido com sucesso.",
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
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
    await exigirSessao();
    const dadosValidados = formClienteSchema.parse(dados);

    const clienteAtualizado = await prisma.cliente.update({
      where: { id: clienteId },
      data: {
        tipoPessoa: dadosValidados.tipoPessoa,
        nomeRazaoSocial: dadosValidados.nomeRazaoSocial.trim(),
        nomeFantasia: dadosValidados.nomeFantasia?.trim() || null,
        documento: dadosValidados.documento.trim(),
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
        categoria: dadosValidados.categoria,
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
        documento: clienteAtualizado.documento,
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
        categoria: clienteAtualizado.categoria,
        observacoes: clienteAtualizado.observacoes,
      },
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("Sessão")) {
      return { sucesso: false, mensagem: erro.message };
    }
    if (erro instanceof ZodError) {
      return {
        sucesso: false,
        mensagem: erro.errors[0]?.message ?? "Dados inválidos.",
      };
    }
    console.error("Erro ao atualizar cliente:", erro);
    return { sucesso: false, mensagem: "Não foi possível atualizar o cliente." };
  }
}

export async function listarClientes() {
  return prisma.cliente.findMany({
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
}

export async function listarClientesPaginado(
  page: number = 1,
  limit: number = 20,
  busca?: string,
  categoria?: string
): Promise<PaginatedResult<{
  id: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
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
  const skip = (page - 1) * limit;

  // Filtro de busca aplicado no banco (case-insensitive via Prisma)
  const where: any = {};

  if (categoria && categoria !== "TODOS") {
    where.categoria = categoria;
  }

  if (busca && busca.trim().length > 0) {
    const termo = busca.trim();
    where.OR = [
      { nomeRazaoSocial: { contains: termo, mode: "insensitive" } },
      { nomeFantasia:     { contains: termo, mode: "insensitive" } },
      { documento:        { contains: termo, mode: "insensitive" } },
      { telefone:         { contains: termo, mode: "insensitive" } },
    ];
  }

  const [total, clientes] = await Promise.all([
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
        categoria: true,
        observacoes: true,
      },
    }),
  ]);

  return {
    data: clientes as any[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export interface ClienteBuscaCRM {
  id: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
  telefone: string;
}

export async function buscarClientesCRM(termo: string): Promise<ClienteBuscaCRM[]> {
  const termoNormalizado = termo.trim();
  if (termoNormalizado.length < 1) return [];

  try {
    const apenasDigitos = termoNormalizado.replace(/\D/g, "");
    
    const whereConditions: any[] = [
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

    return await prisma.cliente.findMany({
      where: {
        OR: whereConditions,
      },
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
