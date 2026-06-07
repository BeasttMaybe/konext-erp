"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";

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

function obterDelegateConfiguracao() {
  const prismaAny = prisma as any;
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
  const prismaAny = prisma as any;
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

export async function atualizarPerfil(usuarioId: string | null, data: DadosPerfil) {
  // C1: exige sessao valida antes de alterar perfil.
  await exigirSessao();

  const prismaAny = prisma as any;
  const usuarioDelegate = prismaAny.usuario ?? prismaAny.Usuario;

  if (!usuarioDelegate?.findFirst || !usuarioDelegate?.update) {
    throw new Error("Delegate Prisma de Usuario nao disponivel.");
  }

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
      throw new Error("Nao foi possivel criar usuario padrao para atualizacao de perfil.");
    }

    usuarioAlvo = await usuarioDelegate.create({
      data: {
        nome: data.nome?.trim() || "Usuario Konext",
        email: data.email?.trim() || `usuario-${Date.now()}@konext.local`,
        senha: "pendente",
        role: "ADMIN",
        fotoPerfilUrl: data.fotoPerfilUrl?.trim() || null,
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
      fotoPerfilUrl: data.fotoPerfilUrl?.trim() || null,
    },
  });

  revalidatePath("/perfil");
  revalidatePath("/", "layout");

  return {
    id: String(usuarioAtualizado.id),
  };
}

export async function atualizarLogoEmpresa(configId: string | null, logoUrl: string, nomeFantasia?: string) {
  // C1: exige sessao valida antes de alterar a logo da empresa.
  await exigirSessao();

  const prismaAny = prisma as any;
  const configuracaoDelegate = prismaAny.configuracao ?? prismaAny.Configuracao;

  if (!configuracaoDelegate?.findFirst || !configuracaoDelegate?.update) {
    throw new Error("Delegate Prisma de Configuracao nao disponivel.");
  }

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
      throw new Error("Nao foi possivel criar configuracao padrao da empresa.");
    }

    configuracaoAlvo = await configuracaoDelegate.create({
      data: {
        nomeFantasia: nomeFantasia?.trim() || "Konext",
        logoUrl: logoUrl.trim() || null,
      },
    });
  }

  await configuracaoDelegate.update({
    where: {
      id: configuracaoAlvo.id,
    },
    data: {
      logoUrl: logoUrl.trim() || null,
      ...(nomeFantasia ? { nomeFantasia: nomeFantasia.trim() } : {}),
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/perfil");

  return {
    id: String(configuracaoAlvo.id),
  };
}