"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { ehPapelEmpresa, exigirPermissao, type PapelEmpresa } from "@/lib/auth/permissoes";
import { resolverPermissoesEfetivas } from "@/lib/auth/resolver-permissoes";
import { prismaCentral } from "@/lib/central/prisma-central";
import { resolverTecnicos, type TecnicoEntrada } from "@/lib/dominio/os/tecnicos";
import { ErroNegocio, paraMensagemSegura } from "@/lib/erros";

type PrismaTenant = Awaited<ReturnType<typeof exigirContextoTenant>>["prisma"];

export type CandidatoTecnico = {
  id: string;
  nome: string;
  email: string;
};

/**
 * Usuarios do tenant cujo vinculo central ativo (nesta empresa) tem a
 * permissao informada — a mesma resolucao de permissoes usada em toda a
 * aplicacao (resolverPermissoesEfetivas, Fase 1D-1), so que aplicada a
 * OUTROS usuarios, nao ao autor da chamada.
 */
async function listarUsuariosComPermissao(
  prisma: PrismaTenant,
  empresaId: string,
  permissao: Parameters<typeof exigirPermissao>[1]
): Promise<CandidatoTecnico[]> {
  const usuariosTenant = await prisma.usuario.findMany({
    select: { id: true, nome: true, email: true },
    orderBy: { nome: "asc" },
  });

  if (usuariosTenant.length === 0) {
    return [];
  }

  const emailsNormalizados = usuariosTenant.map((usuario) => usuario.email.trim().toLowerCase());

  const usuariosCentral = await prismaCentral.usuarioCentral.findMany({
    where: { email: { in: emailsNormalizados, mode: "insensitive" }, ativo: true },
    select: { id: true, email: true },
  });

  if (usuariosCentral.length === 0) {
    return [];
  }

  const centralIdPorEmail = new Map(usuariosCentral.map((usuario) => [usuario.email.trim().toLowerCase(), usuario.id]));

  const vinculos = await prismaCentral.usuarioEmpresa.findMany({
    where: {
      empresaId,
      ativo: true,
      usuarioId: { in: usuariosCentral.map((usuario) => usuario.id) },
    },
    select: { usuarioId: true, role: true },
  });

  const papelPorCentralId = new Map<string, PapelEmpresa>(
    vinculos.map((vinculo) => [vinculo.usuarioId, ehPapelEmpresa(vinculo.role) ? vinculo.role : "USUARIO"])
  );

  const candidatos: CandidatoTecnico[] = [];

  for (const usuario of usuariosTenant) {
    const centralId = centralIdPorEmail.get(usuario.email.trim().toLowerCase());
    if (!centralId) continue;

    const papel = papelPorCentralId.get(centralId);
    if (!papel) continue;

    const permissoes = await resolverPermissoesEfetivas(centralId, empresaId, papel);
    if (permissoes.has(permissao)) {
      candidatos.push(usuario);
    }
  }

  return candidatos;
}

/** Candidatos a tecnico de uma OS: usuarios cujo cargo tem os.editar — nunca a lista inteira de usuarios. */
export async function listarCandidatosTecnicosOS(): Promise<
  { sucesso: true; dados: CandidatoTecnico[] } | { sucesso: false; erro: string }
> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");

    const candidatos = await listarUsuariosComPermissao(contexto.prisma, contexto.empresaId, "os.editar");
    return { sucesso: true, dados: candidatos };
  } catch (erro) {
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}

const schemaTecnicoEntrada = z.object({
  usuarioId: z.string().min(1),
  participacaoPercentual: z.number().min(0).max(100).optional(),
  principal: z.boolean().optional(),
});

const schemaDefinirTecnicos = z.object({
  osId: z.string().min(1, "Informe a OS."),
  tecnicos: z.array(schemaTecnicoEntrada),
});

export type ResultadoDefinirTecnicosOS = { sucesso: true } | { sucesso: false; erro: string };

/**
 * Define a lista de tecnicos de uma OS de uma vez (substitui a lista
 * inteira) — mais simples e sem risco de estado parcial do que
 * adicionar/remover um por um. lib/dominio/os/tecnicos.ts decide participacao
 * e principal; esta funcao so valida, persiste e audita.
 */
export async function definirTecnicosOS(
  input: z.infer<typeof schemaDefinirTecnicos>
): Promise<ResultadoDefinirTecnicosOS> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");

    const analise = schemaDefinirTecnicos.safeParse(input);
    if (!analise.success) {
      return { sucesso: false, erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const dados = analise.data;

    const candidatos = await listarUsuariosComPermissao(contexto.prisma, contexto.empresaId, "os.editar");
    const idsValidos = new Set(candidatos.map((candidato) => candidato.id));
    const invalido = dados.tecnicos.find((tecnico) => !idsValidos.has(tecnico.usuarioId));
    if (invalido) {
      return { sucesso: false, erro: "Um dos usuários selecionados não pode ser técnico desta OS." };
    }

    const resolucao = resolverTecnicos(dados.tecnicos as readonly TecnicoEntrada[]);
    if (!resolucao.sucesso) {
      return { sucesso: false, erro: resolucao.erro };
    }

    const osExistente = await contexto.prisma.ordemServico.findUnique({
      where: { id: dados.osId },
      select: {
        id: true,
        excluidaEm: true,
        tecnicos: {
          select: { usuarioId: true, participacaoPercentual: true, principal: true },
        },
      },
    });

    if (!osExistente) {
      return { sucesso: false, erro: "Ordem de serviço não encontrada." };
    }
    if (osExistente.excluidaEm) {
      return { sucesso: false, erro: "Esta OS foi excluída e não pode ter técnicos alterados." };
    }

    const tecnicosAntes = osExistente.tecnicos.map((tecnico) => ({
      usuarioId: tecnico.usuarioId,
      participacaoPercentual: Number(tecnico.participacaoPercentual),
      principal: tecnico.principal,
    }));

    await contexto.prisma.$transaction(async (tx) => {
      await tx.tecnicoOS.deleteMany({ where: { osId: dados.osId } });

      if (resolucao.tecnicos.length > 0) {
        await tx.tecnicoOS.createMany({
          data: resolucao.tecnicos.map((tecnico) => ({
            osId: dados.osId,
            usuarioId: tecnico.usuarioId,
            participacaoPercentual: tecnico.participacaoPercentual,
            principal: tecnico.principal,
          })),
        });
      }

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(contexto.usuarioOperacional, "app/actions/tecnicos-os.ts:definirTecnicosOS"),
        {
          acao: ACOES_AUDITORIA.DEFINIR_TECNICOS_OS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: dados.osId,
          dadosAntes: { tecnicos: tecnicosAntes },
          dadosDepois: { tecnicos: resolucao.tecnicos },
        }
      );
    });

    revalidatePath("/os");
    revalidatePath(`/os/${dados.osId}`);

    return { sucesso: true };
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return { sucesso: false, erro: erro.message };
    }
    return { sucesso: false, erro: paraMensagemSegura(erro) };
  }
}
