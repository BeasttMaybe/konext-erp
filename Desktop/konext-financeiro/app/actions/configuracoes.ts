"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";

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

export async function obterConfiguracoes() {
  const configuracaoDelegate = obterDelegateConfiguracao();

  if (!configuracaoDelegate?.findFirst) {
    return {
      id: "",
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
  };
}

export async function salvarConfiguracoes(data: DadosConfiguracoes) {
  // C1: exige sessao valida antes de alterar configuracoes da empresa.
  await exigirSessao();

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
      },
    });
  }

  if (!configuracao) {
    throw new Error("Nao foi possivel inicializar as configuracoes do sistema.");
  }

  await configuracaoDelegate.update({
    where: {
      id: configuracao.id,
    },
    data: {
      razaoSocial: data.razaoSocial.trim(),
      nomeFantasia: data.nomeFantasia.trim() || "Konext",
      cnpj: data.cnpj.trim(),
      inscricaoEstadual: data.inscricaoEstadual.trim(),
      telefone: data.telefone.trim(),
      cep: data.cep.trim(),
      logradouro: data.logradouro.trim(),
      numero: data.numero.trim(),
      bairro: data.bairro.trim(),
      cidade: data.cidade.trim(),
      estado: data.estado.trim(),
      endereco: data.endereco.trim(),
      chavePix: data.chavePix.trim() || null,
      mensagemCupom: data.mensagemCupom.trim() || null,
      habilitarMargemAutomatica: Boolean(data.habilitarMargemAutomatica),
      permitirVendaSemEstoque: Boolean(data.permitirVendaSemEstoque),
      logoUrl: data.logoUrl.trim() || null,
    },
  });

  revalidatePath("/configuracoes");
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