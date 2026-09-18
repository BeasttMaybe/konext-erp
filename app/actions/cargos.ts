"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import {
  CATALOGO_PERMISSOES,
  ehPermissao,
  exigirPermissao,
  listarCatalogoAgrupado,
  type Permissao,
  type PermissaoDisponivel,
} from "@/lib/auth/permissoes";
import { mapearCargoParaRoleLegado } from "@/lib/auth/mapear-cargo-legado";
import {
  contarAdminsAtivos,
  podeArquivarCargo,
  podeAtribuirCargoAoUsuario,
  podeConcederPermissoes,
  podeEditarPermissoesConsiderandoAutor,
  podeEditarPermissoesDoCargo,
  podeRemoverAcessoAdminDoUsuario,
  podeRenomearCargo,
  type UsuarioComAcessoAdmin,
} from "@/lib/auth/invariantes-cargos";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaCentralDoUsuario, registrarLogAuditoriaCentral } from "@/lib/auditoria-central";
import { prismaCentral } from "@/lib/central/prisma-central";
import { paraMensagemSegura } from "@/lib/erros";

const schemaPermissao = z.custom<Permissao>((valor) => typeof valor === "string" && ehPermissao(valor), {
  message: "Permissão desconhecida.",
});

const schemaNomeCargo = z
  .string()
  .trim()
  .min(2, "Informe um nome com pelo menos 2 caracteres.")
  .max(60, "O nome do cargo não pode passar de 60 caracteres.");

const schemaDescricaoCargo = z
  .string()
  .trim()
  .max(300, "A descrição não pode passar de 300 caracteres.")
  .optional();

const schemaListaPermissoes = z.array(schemaPermissao);

const schemaCriarCargo = z.object({
  nome: schemaNomeCargo,
  descricao: schemaDescricaoCargo,
  permissoes: schemaListaPermissoes,
});

const schemaRenomearCargo = z.object({
  cargoId: z.string().min(1, "Informe o cargo."),
  nome: schemaNomeCargo,
});

const schemaDefinirPermissoesDoCargo = z.object({
  cargoId: z.string().min(1, "Informe o cargo."),
  permissoes: schemaListaPermissoes,
});

const schemaDuplicarCargo = z.object({
  cargoId: z.string().min(1, "Informe o cargo a duplicar."),
  novoNome: schemaNomeCargo,
});

const schemaArquivarCargo = z.object({
  cargoId: z.string().min(1, "Informe o cargo."),
});

const schemaAtribuirCargoAoUsuario = z.object({
  usuarioEmpresaId: z.string().min(1, "Informe o usuário."),
  cargoId: z.string().min(1, "Informe o cargo."),
});

export type ResultadoAcaoCargo =
  | { sucesso: true }
  | { sucesso: false; erro: string };

export type ResultadoCriarCargo =
  | { sucesso: true; cargoId: string }
  | { sucesso: false; erro: string };

export type CargoListado = {
  id: string;
  nome: string;
  descricao: string | null;
  fixo: boolean;
  arquivadoEm: string | null;
  quantidadeUsuariosAtivos: number;
  permissoes: Permissao[];
};

type CargoComPermissoes = {
  id: string;
  empresaId: string;
  nome: string;
  fixo: boolean;
  arquivadoEm: Date | null;
  permissoes: { permissao: string }[];
};

/** Permissoes efetivas de um Cargo: catalogo inteiro se fixo, senao as linhas gravadas. */
function permissoesEfetivasDoCargo(cargo: { fixo: boolean; permissoes: { permissao: string }[] }): Permissao[] {
  if (cargo.fixo) {
    return [...CATALOGO_PERMISSOES];
  }
  return cargo.permissoes.map((linha) => linha.permissao).filter(ehPermissao);
}

function primeiroErroZod(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}

/**
 * Todo vinculo da empresa, com se cada um possui (efetivamente) a permissao
 * configuracoes.usuarios — base pra checar a invariante "sempre sobra 1
 * admin ativo" (lib/auth/invariantes-cargos.ts).
 */
async function listarUsuariosComAcessoAdmin(empresaId: string): Promise<UsuarioComAcessoAdmin[]> {
  const vinculos = await prismaCentral.usuarioEmpresa.findMany({
    where: { empresaId },
    select: {
      usuarioId: true,
      ativo: true,
      cargo: { select: { fixo: true, permissoes: { select: { permissao: true } } } },
    },
  });

  return vinculos.map((vinculo) => ({
    usuarioId: vinculo.usuarioId,
    ativo: vinculo.ativo,
    possuiConfiguracoesUsuarios: vinculo.cargo
      ? permissoesEfetivasDoCargo(vinculo.cargo).includes("configuracoes.usuarios")
      : false,
  }));
}

function revalidarTelasDeConfiguracoes(): void {
  revalidatePath("/configuracoes");
}

/** Catalogo de permissoes agrupado por modulo, com rotulo e descricao em pt-BR — pronto pra tela de cargos da Fase 1D-2. */
export async function listarPermissoesDisponiveis(): Promise<
  { sucesso: true; dados: PermissaoDisponivel[] } | { sucesso: false; erro: string }
> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    return { sucesso: true, dados: [...listarCatalogoAgrupado()] };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function listarCargos(): Promise<
  { sucesso: true; dados: CargoListado[] } | { sucesso: false; erro: string }
> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const cargos = await prismaCentral.cargo.findMany({
      where: { empresaId: contexto.empresaId },
      select: {
        id: true,
        nome: true,
        descricao: true,
        fixo: true,
        arquivadoEm: true,
        permissoes: { select: { permissao: true } },
        usuarios: { where: { ativo: true }, select: { id: true } },
      },
      orderBy: { criadoEm: "asc" },
    });

    return {
      sucesso: true,
      dados: cargos.map((cargo) => ({
        id: cargo.id,
        nome: cargo.nome,
        descricao: cargo.descricao,
        fixo: cargo.fixo,
        arquivadoEm: cargo.arquivadoEm ? cargo.arquivadoEm.toISOString() : null,
        quantidadeUsuariosAtivos: cargo.usuarios.length,
        permissoes: permissoesEfetivasDoCargo(cargo),
      })),
    };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function criarCargo(input: z.infer<typeof schemaCriarCargo>): Promise<ResultadoCriarCargo> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaCriarCargo.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: primeiroErroZod(analise.error) };
    }
    const dados = analise.data;

    const checagemConcessao = podeConcederPermissoes({
      permissoesDoAutor: contexto.permissoes ?? new Set<Permissao>(),
      permissoesAlvo: dados.permissoes,
    });
    if (!checagemConcessao.permitido) {
      return { sucesso: false, erro: checagemConcessao.motivo };
    }

    const existente = await prismaCentral.cargo.findUnique({
      where: { empresaId_nome: { empresaId: contexto.empresaId, nome: dados.nome } },
      select: { id: true },
    });
    if (existente) {
      return { sucesso: false, erro: `Já existe um cargo chamado "${dados.nome}" nesta empresa.` };
    }

    const criado = await prismaCentral.$transaction(async (tx) => {
      const cargo = await tx.cargo.create({
        data: {
          empresaId: contexto.empresaId,
          nome: dados.nome,
          descricao: dados.descricao ?? null,
          fixo: false,
          permissoes: { create: dados.permissoes.map((permissao) => ({ permissao })) },
        },
        select: { id: true },
      });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario({ id: contexto.usuarioCentralId }, contexto.empresaId, "app/actions/cargos.ts:criarCargo"),
        {
          acao: ACOES_AUDITORIA.CRIAR_CARGO,
          entidade: ENTIDADES_AUDITORIA.CARGO,
          entidadeId: cargo.id,
          dadosDepois: { nome: dados.nome, descricao: dados.descricao ?? null, permissoes: dados.permissoes },
        }
      );

      return cargo;
    });

    revalidarTelasDeConfiguracoes();
    return { sucesso: true, cargoId: criado.id };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

async function buscarCargoDaEmpresa(cargoId: string, empresaId: string): Promise<CargoComPermissoes | null> {
  const cargo = await prismaCentral.cargo.findUnique({
    where: { id: cargoId },
    select: {
      id: true,
      empresaId: true,
      nome: true,
      fixo: true,
      arquivadoEm: true,
      permissoes: { select: { permissao: true } },
    },
  });

  if (!cargo || cargo.empresaId !== empresaId) {
    return null;
  }

  return cargo;
}

export async function renomearCargo(input: z.infer<typeof schemaRenomearCargo>): Promise<ResultadoAcaoCargo> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaRenomearCargo.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: primeiroErroZod(analise.error) };
    }
    const dados = analise.data;

    const cargo = await buscarCargoDaEmpresa(dados.cargoId, contexto.empresaId);
    if (!cargo) {
      return { sucesso: false, erro: "Cargo não encontrado." };
    }

    const checagemFixo = podeRenomearCargo(cargo);
    if (!checagemFixo.permitido) {
      return { sucesso: false, erro: checagemFixo.motivo };
    }

    if (dados.nome !== cargo.nome) {
      const conflito = await prismaCentral.cargo.findUnique({
        where: { empresaId_nome: { empresaId: contexto.empresaId, nome: dados.nome } },
        select: { id: true },
      });
      if (conflito) {
        return { sucesso: false, erro: `Já existe um cargo chamado "${dados.nome}" nesta empresa.` };
      }
    }

    await prismaCentral.$transaction(async (tx) => {
      await tx.cargo.update({ where: { id: cargo.id }, data: { nome: dados.nome } });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario({ id: contexto.usuarioCentralId }, contexto.empresaId, "app/actions/cargos.ts:renomearCargo"),
        {
          acao: ACOES_AUDITORIA.RENOMEAR_CARGO,
          entidade: ENTIDADES_AUDITORIA.CARGO,
          entidadeId: cargo.id,
          dadosAntes: { nome: cargo.nome },
          dadosDepois: { nome: dados.nome },
        }
      );
    });

    revalidarTelasDeConfiguracoes();
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function definirPermissoesDoCargo(
  input: z.infer<typeof schemaDefinirPermissoesDoCargo>
): Promise<ResultadoAcaoCargo> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaDefinirPermissoesDoCargo.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: primeiroErroZod(analise.error) };
    }
    const dados = analise.data;

    const cargo = await prismaCentral.cargo.findUnique({
      where: { id: dados.cargoId },
      select: {
        id: true,
        empresaId: true,
        fixo: true,
        permissoes: { select: { permissao: true } },
        usuarios: { select: { id: true, usuarioId: true, ativo: true } },
      },
    });
    if (!cargo || cargo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Cargo não encontrado." };
    }

    const checagemFixo = podeEditarPermissoesDoCargo(cargo);
    if (!checagemFixo.permitido) {
      return { sucesso: false, erro: checagemFixo.motivo };
    }

    const checagemAutor = podeEditarPermissoesConsiderandoAutor({
      autorUsuarioCentralId: contexto.usuarioCentralId,
      usuariosDoCargoIds: cargo.usuarios.map((usuario) => usuario.usuarioId),
    });
    if (!checagemAutor.permitido) {
      return { sucesso: false, erro: checagemAutor.motivo };
    }

    const checagemConcessao = podeConcederPermissoes({
      permissoesDoAutor: contexto.permissoes ?? new Set<Permissao>(),
      permissoesAlvo: dados.permissoes,
    });
    if (!checagemConcessao.permitido) {
      return { sucesso: false, erro: checagemConcessao.motivo };
    }

    const possuiaConfigUsuarios = permissoesEfetivasDoCargo(cargo).includes("configuracoes.usuarios");
    const passaAPossuirConfigUsuarios = dados.permissoes.includes("configuracoes.usuarios");
    const usuariosAtivosDesteCargo = cargo.usuarios.filter((usuario) => usuario.ativo).map((usuario) => usuario.usuarioId);

    if (possuiaConfigUsuarios && !passaAPossuirConfigUsuarios && usuariosAtivosDesteCargo.length > 0) {
      const todosUsuarios = await listarUsuariosComAcessoAdmin(contexto.empresaId);
      const idsDesteCargo = new Set(usuariosAtivosDesteCargo);
      const simulacao = todosUsuarios.map((usuario) =>
        idsDesteCargo.has(usuario.usuarioId) ? { ...usuario, possuiConfiguracoesUsuarios: false } : usuario
      );

      if (contarAdminsAtivos(simulacao) === 0) {
        return {
          sucesso: false,
          erro:
            "Esta mudança deixaria a empresa sem nenhum usuário ativo com acesso a configurações e usuários. Mantenha essa permissão em pelo menos um cargo em uso antes de continuar.",
        };
      }
    }

    const novoRoleLegado = mapearCargoParaRoleLegado({ fixo: false, permissoes: new Set(dados.permissoes) });

    await prismaCentral.$transaction(async (tx) => {
      await tx.cargoPermissao.deleteMany({ where: { cargoId: cargo.id } });

      if (dados.permissoes.length > 0) {
        await tx.cargoPermissao.createMany({
          data: dados.permissoes.map((permissao) => ({ cargoId: cargo.id, permissao })),
        });
      }

      if (cargo.usuarios.length > 0) {
        await tx.usuarioEmpresa.updateMany({ where: { cargoId: cargo.id }, data: { role: novoRoleLegado } });
      }

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario(
          { id: contexto.usuarioCentralId },
          contexto.empresaId,
          "app/actions/cargos.ts:definirPermissoesDoCargo"
        ),
        {
          acao: ACOES_AUDITORIA.DEFINIR_PERMISSOES_CARGO,
          entidade: ENTIDADES_AUDITORIA.CARGO,
          entidadeId: cargo.id,
          dadosAntes: { permissoes: permissoesEfetivasDoCargo(cargo) },
          dadosDepois: { permissoes: dados.permissoes, roleLegadoAplicado: novoRoleLegado },
        }
      );
    });

    revalidarTelasDeConfiguracoes();
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function duplicarCargo(input: z.infer<typeof schemaDuplicarCargo>): Promise<ResultadoCriarCargo> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaDuplicarCargo.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: primeiroErroZod(analise.error) };
    }
    const dados = analise.data;

    const original = await buscarCargoDaEmpresa(dados.cargoId, contexto.empresaId);
    if (!original) {
      return { sucesso: false, erro: "Cargo não encontrado." };
    }

    const conflito = await prismaCentral.cargo.findUnique({
      where: { empresaId_nome: { empresaId: contexto.empresaId, nome: dados.novoNome } },
      select: { id: true },
    });
    if (conflito) {
      return { sucesso: false, erro: `Já existe um cargo chamado "${dados.novoNome}" nesta empresa.` };
    }

    // Duplicar o cargo fixo (Administrador) produz uma copia NAO fixa com as
    // mesmas permissoes — duplicar nunca cria um segundo cargo fixo.
    const permissoesOriginais = permissoesEfetivasDoCargo(original);

    const checagemConcessao = podeConcederPermissoes({
      permissoesDoAutor: contexto.permissoes ?? new Set<Permissao>(),
      permissoesAlvo: permissoesOriginais,
    });
    if (!checagemConcessao.permitido) {
      return { sucesso: false, erro: checagemConcessao.motivo };
    }

    const criado = await prismaCentral.$transaction(async (tx) => {
      const cargo = await tx.cargo.create({
        data: {
          empresaId: contexto.empresaId,
          nome: dados.novoNome,
          descricao: null,
          fixo: false,
          permissoes: { create: permissoesOriginais.map((permissao) => ({ permissao })) },
        },
        select: { id: true },
      });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario({ id: contexto.usuarioCentralId }, contexto.empresaId, "app/actions/cargos.ts:duplicarCargo"),
        {
          acao: ACOES_AUDITORIA.DUPLICAR_CARGO,
          entidade: ENTIDADES_AUDITORIA.CARGO,
          entidadeId: cargo.id,
          dadosDepois: {
            duplicadoDeCargoId: original.id,
            duplicadoDeCargoNome: original.nome,
            nome: dados.novoNome,
            permissoes: permissoesOriginais,
          },
        }
      );

      return cargo;
    });

    revalidarTelasDeConfiguracoes();
    return { sucesso: true, cargoId: criado.id };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function arquivarCargo(input: z.infer<typeof schemaArquivarCargo>): Promise<ResultadoAcaoCargo> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaArquivarCargo.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: primeiroErroZod(analise.error) };
    }
    const dados = analise.data;

    const cargo = await prismaCentral.cargo.findUnique({
      where: { id: dados.cargoId },
      select: {
        id: true,
        empresaId: true,
        fixo: true,
        arquivadoEm: true,
        usuarios: { where: { ativo: true }, select: { id: true } },
      },
    });
    if (!cargo || cargo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Cargo não encontrado." };
    }
    if (cargo.arquivadoEm) {
      return { sucesso: false, erro: "Este cargo já está arquivado." };
    }

    const checagem = podeArquivarCargo({ fixo: cargo.fixo, quantidadeUsuariosAtivos: cargo.usuarios.length });
    if (!checagem.permitido) {
      return { sucesso: false, erro: checagem.motivo };
    }

    const agora = new Date();

    await prismaCentral.$transaction(async (tx) => {
      await tx.cargo.update({ where: { id: cargo.id }, data: { arquivadoEm: agora } });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario({ id: contexto.usuarioCentralId }, contexto.empresaId, "app/actions/cargos.ts:arquivarCargo"),
        {
          acao: ACOES_AUDITORIA.ARQUIVAR_CARGO,
          entidade: ENTIDADES_AUDITORIA.CARGO,
          entidadeId: cargo.id,
          dadosAntes: { arquivadoEm: null },
          dadosDepois: { arquivadoEm: agora.toISOString() },
        }
      );
    });

    revalidarTelasDeConfiguracoes();
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

export async function atribuirCargoAoUsuario(
  input: z.infer<typeof schemaAtribuirCargoAoUsuario>
): Promise<ResultadoAcaoCargo> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.usuarios");

    const analise = schemaAtribuirCargoAoUsuario.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: primeiroErroZod(analise.error) };
    }
    const dados = analise.data;

    const vinculoAlvo = await prismaCentral.usuarioEmpresa.findUnique({
      where: { id: dados.usuarioEmpresaId },
      select: {
        id: true,
        usuarioId: true,
        empresaId: true,
        ativo: true,
        cargoId: true,
        cargo: { select: { fixo: true, permissoes: { select: { permissao: true } } } },
      },
    });
    if (!vinculoAlvo || vinculoAlvo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Usuário não encontrado nesta empresa." };
    }

    const checagemSelf = podeAtribuirCargoAoUsuario({
      autorUsuarioCentralId: contexto.usuarioCentralId,
      usuarioAlvoCentralId: vinculoAlvo.usuarioId,
    });
    if (!checagemSelf.permitido) {
      return { sucesso: false, erro: checagemSelf.motivo };
    }

    const novoCargo = await prismaCentral.cargo.findUnique({
      where: { id: dados.cargoId },
      select: { id: true, empresaId: true, fixo: true, arquivadoEm: true, permissoes: { select: { permissao: true } } },
    });
    if (!novoCargo || novoCargo.empresaId !== contexto.empresaId) {
      return { sucesso: false, erro: "Cargo não encontrado." };
    }
    if (novoCargo.arquivadoEm) {
      return { sucesso: false, erro: "Este cargo está arquivado e não pode ser atribuído a ninguém." };
    }

    const permissoesNovoCargo = permissoesEfetivasDoCargo(novoCargo);

    // Atribuir um cargo e uma forma de conceder as permissoes dele — mesma
    // regra de "ninguem concede o que nao tem".
    const checagemConcessao = podeConcederPermissoes({
      permissoesDoAutor: contexto.permissoes ?? new Set<Permissao>(),
      permissoesAlvo: permissoesNovoCargo,
    });
    if (!checagemConcessao.permitido) {
      return { sucesso: false, erro: checagemConcessao.motivo };
    }

    const possuiaConfigUsuarios = vinculoAlvo.cargo
      ? permissoesEfetivasDoCargo(vinculoAlvo.cargo).includes("configuracoes.usuarios")
      : false;
    const passaAPossuirConfigUsuarios = permissoesNovoCargo.includes("configuracoes.usuarios");

    if (possuiaConfigUsuarios && !passaAPossuirConfigUsuarios) {
      const todosUsuarios = await listarUsuariosComAcessoAdmin(contexto.empresaId);
      const checagemAdmin = podeRemoverAcessoAdminDoUsuario(todosUsuarios, vinculoAlvo.usuarioId);
      if (!checagemAdmin.permitido) {
        return { sucesso: false, erro: checagemAdmin.motivo };
      }
    }

    const novoRoleLegado = mapearCargoParaRoleLegado({ fixo: novoCargo.fixo, permissoes: new Set(permissoesNovoCargo) });

    await prismaCentral.$transaction(async (tx) => {
      await tx.usuarioEmpresa.update({
        where: { id: vinculoAlvo.id },
        data: { cargoId: novoCargo.id, role: novoRoleLegado },
      });

      await registrarLogAuditoriaCentral(
        tx,
        contextoAuditoriaCentralDoUsuario(
          { id: contexto.usuarioCentralId },
          contexto.empresaId,
          "app/actions/cargos.ts:atribuirCargoAoUsuario"
        ),
        {
          acao: ACOES_AUDITORIA.ATRIBUIR_CARGO_USUARIO,
          entidade: ENTIDADES_AUDITORIA.USUARIO_EMPRESA,
          entidadeId: vinculoAlvo.id,
          dadosAntes: { cargoId: vinculoAlvo.cargoId },
          dadosDepois: { cargoId: novoCargo.id, roleLegadoAplicado: novoRoleLegado },
        }
      );
    });

    revalidarTelasDeConfiguracoes();
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}
