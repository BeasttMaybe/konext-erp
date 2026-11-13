import "server-only";

import { IDS_DE_MODULO, MODULOS, resolverModulosAtivos, type IdModulo } from "@erp/lib/modulos/catalogo";
import { central } from "~/lib/prisma-central";

/**
 * Leituras do painel — SO LEITURA, so do banco central. Nenhuma consulta abre
 * o banco de uma loja: o master ve a loja de fora (cadastro, acessos,
 * modulos, erros), nunca os clientes ou as vendas dela.
 */

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export type LojaResumo = {
  id: string;
  nome: string;
  slug: string;
  status: string;
  tenantStatus: string | null;
  versaoSchema: string | null;
  criadoEm: Date;
  responsavel: string | null;
  usuariosAtivos: number;
  usuariosTotal: number;
  modulosAtivos: number;
  erros24h: number;
  ultimoAcesso: Date | null;
};

export async function listarLojas(): Promise<LojaResumo[]> {
  const db = central();
  const desde = new Date(Date.now() - UM_DIA_MS);
  const [empresas, usuarios, modulos, erros, acessos] = await Promise.all([
    db.empresa.findMany({
      orderBy: { criadoEm: "asc" },
      select: {
        id: true,
        nome: true,
        slug: true,
        status: true,
        criadoEm: true,
        tenants: { select: { status: true, versaoSchema: true }, take: 1, orderBy: { criadoEm: "asc" } },
        proprietario: { select: { usuario: { select: { nome: true } } } },
      },
    }),
    db.usuarioEmpresa.groupBy({ by: ["empresaId", "ativo"], _count: { _all: true } }),
    db.moduloEmpresa.findMany({ select: { empresaId: true, modulo: true, ativo: true } }),
    db.erroDoSistema.groupBy({ by: ["empresaId"], where: { criadoEm: { gte: desde } }, _count: { _all: true } }),
    db.sessaoCentral.groupBy({ by: ["empresaId"], _max: { ultimoUsoEm: true, criadoEm: true } }),
  ]);

  return empresas.map((empresa) => {
    const deUsuarios = usuarios.filter((u) => u.empresaId === empresa.id);
    const acesso = acessos.find((a) => a.empresaId === empresa.id)?._max;
    const ultimo = [acesso?.ultimoUsoEm, acesso?.criadoEm].filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      id: empresa.id,
      nome: empresa.nome,
      slug: empresa.slug,
      status: empresa.status,
      tenantStatus: empresa.tenants[0]?.status ?? null,
      versaoSchema: empresa.tenants[0]?.versaoSchema ?? null,
      criadoEm: empresa.criadoEm,
      responsavel: empresa.proprietario?.usuario.nome ?? null,
      usuariosAtivos: deUsuarios.filter((u) => u.ativo).reduce((t, u) => t + u._count._all, 0),
      usuariosTotal: deUsuarios.reduce((t, u) => t + u._count._all, 0),
      modulosAtivos: resolverModulosAtivos(modulos.filter((m) => m.empresaId === empresa.id)).size,
      erros24h: erros.find((e) => e.empresaId === empresa.id)?._count._all ?? 0,
      ultimoAcesso: ultimo ?? null,
    };
  });
}

export type ModuloDaLoja = {
  id: IdModulo;
  nome: string;
  descricao: string;
  ativo: boolean;
  motivo: "padrao" | "gravado" | "dependencia";
  /** O master gravou "desligado" para este modulo (o interruptor). */
  desligadoPeloMaster: boolean;
};

export async function detalheDaLoja(empresaId: string) {
  const db = central();
  const empresa = await db.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      nome: true,
      slug: true,
      status: true,
      criadoEm: true,
      proprietarioUsuarioEmpresaId: true,
      tenants: { select: { slug: true, status: true, versaoSchema: true, criadoEm: true } },
    },
  });
  if (!empresa) return null;

  const [vinculos, gravados, erros, auditoria, sessoes, historico] = await Promise.all([
    db.usuarioEmpresa.findMany({
      where: { empresaId },
      orderBy: { criadoEm: "asc" },
      select: {
        id: true,
        ativo: true,
        usuarioId: true,
        cargo: { select: { nome: true } },
        usuario: { select: { nome: true, email: true } },
      },
    }),
    db.moduloEmpresa.findMany({ where: { empresaId }, select: { modulo: true, ativo: true } }),
    db.erroDoSistema.findMany({
      where: { empresaId },
      orderBy: { criadoEm: "desc" },
      take: 20,
      select: { id: true, origem: true, mensagem: true, criadoEm: true },
    }),
    db.logAuditoria.findMany({
      where: { empresaId },
      orderBy: { criadoEm: "desc" },
      take: 15,
      select: { id: true, acao: true, entidade: true, criadoEm: true },
    }),
    db.sessaoCentral.groupBy({ by: ["usuarioCentralId"], where: { empresaId }, _max: { ultimoUsoEm: true, criadoEm: true } }),
    db.registroMaster.findMany({
      where: { empresaId },
      orderBy: { criadoEm: "desc" },
      take: 20,
      select: { id: true, acao: true, detalhes: true, criadoEm: true, administrador: { select: { nome: true } } },
    }),
  ]);

  const ativos = resolverModulosAtivos(gravados);
  const modulos: ModuloDaLoja[] = MODULOS.map((m) => {
    const desligadoPeloMaster = gravados.some((g) => g.modulo === m.id && !g.ativo);
    const ativo = ativos.has(m.id);
    return {
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      ativo,
      motivo: desligadoPeloMaster ? "gravado" : ativo ? "padrao" : "dependencia",
      desligadoPeloMaster,
    };
  });

  const usuarios = vinculos.map((v) => {
    const s = sessoes.find((x) => x.usuarioCentralId === v.usuarioId)?._max;
    const ultimo = [s?.ultimoUsoEm, s?.criadoEm].filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      id: v.id,
      nome: v.usuario.nome,
      email: v.usuario.email,
      cargo: v.cargo?.nome ?? null,
      ativo: v.ativo,
      responsavel: v.id === empresa.proprietarioUsuarioEmpresaId,
      ultimoAcesso: ultimo ?? null,
    };
  });

  return { empresa, usuarios, modulos, totalDeModulos: IDS_DE_MODULO.length, erros, auditoria, historico };
}
