import { exigirSessaoCentral } from "@/lib/auth/sessao-central";
import { obterPrismaTenant } from "@/lib/tenant/prisma-tenant";
import { resolverConexaoTenant } from "@/lib/tenant/resolver-conexao-tenant";
import { ehPapelEmpresa, type PapelEmpresa } from "@/lib/auth/permissoes";
import { resolverPermissoesEfetivas } from "@/lib/auth/resolver-permissoes";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import type { ContextoTenantServidor } from "@/types/tenant";

type UsuarioOperacionalMapeado = {
  id: string;
  nome: string;
  email: string;
  role: string;
};

/**
 * Mapeamento read-only do usuario central para um Usuario operacional
 * pre-existente no banco do tenant (por e-mail). Nunca cria usuario.
 * Sem correspondencia local, o id fica vazio e fluxos tratam como null.
 *
 * O `role` devolvido aqui e o `Usuario.role` do TENANT (ADMIN/OPERADOR/TECNICO)
 * quando ha correspondencia — e so por isso NUNCA deve ser usado para
 * autorizacao. Autorizacao usa exclusivamente `papelEmpresa` (ver abaixo).
 */
async function mapearUsuarioOperacional(
  prisma: ContextoTenantServidor["prisma"],
  email: string,
  fallback: { nome: string; role: string }
): Promise<UsuarioOperacionalMapeado> {
  const semMapeamento: UsuarioOperacionalMapeado = {
    id: "",
    nome: fallback.nome,
    email,
    role: fallback.role,
  };

  const emailNormalizado = email.trim().toLowerCase();

  if (!emailNormalizado) {
    return semMapeamento;
  }

  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        email: {
          equals: emailNormalizado,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
      },
    });

    if (!usuario) {
      return semMapeamento;
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: String(usuario.role),
    };
  } catch {
    return semMapeamento;
  }
}

/**
 * `SessaoCentral.role` vem do enum central `RoleEmpresa` — sempre um dos tres
 * valores. O fallback so existe para blindar contra um valor corrompido/legado
 * chegando do banco; nesse caso tratamos como o papel menos privilegiado.
 */
function normalizarPapelEmpresa(role: string): PapelEmpresa {
  return ehPapelEmpresa(role) ? role : "USUARIO";
}

/**
 * Fuso horário da loja (Fase 2A-1) — lido uma vez por requisicao, aqui,
 * porque este ja e o ponto unico de resolucao de contexto por requisicao do
 * projeto (mesmo raciocinio de resolverPermissoesEfetivas acima). Nunca lido
 * ad hoc em nenhum outro lugar: todo calculo de fronteira de dia/semana/mes
 * usa contexto.fusoHorario via lib/datas.ts.
 */
async function resolverFusoHorarioTenant(
  prisma: ContextoTenantServidor["prisma"]
): Promise<string> {
  try {
    const configuracao = await prisma.configuracao.findFirst({
      orderBy: { criadoEm: "asc" },
      select: { fusoHorario: true },
    });

    const valor = configuracao?.fusoHorario?.trim();
    return valor && valor.length > 0 ? valor : FUSO_HORARIO_PADRAO;
  } catch {
    // Sem linha de Configuracao ainda (tenant recem-provisionado) ou coluna
    // ausente num runtime legado: cai pro default do schema, nunca quebra a
    // resolucao de contexto por causa do fuso.
    return FUSO_HORARIO_PADRAO;
  }
}

export async function exigirContextoTenant(): Promise<ContextoTenantServidor> {
  const sessaoCentral = await exigirSessaoCentral();

  const connectionString = resolverConexaoTenant(sessaoCentral.connectionRef);
  const prisma = obterPrismaTenant({
    tenantId: sessaoCentral.tenantId,
    connectionString,
  });

  const usuarioOperacional = await mapearUsuarioOperacional(prisma, sessaoCentral.usuarioEmail, {
    nome: sessaoCentral.usuarioNome,
    role: sessaoCentral.role,
  });

  const papelEmpresa = normalizarPapelEmpresa(sessaoCentral.role);

  // Resolvido do Cargo do usuario, uma vez por requisicao (Fase 1D-1) — ver
  // o comentario em lib/auth/resolver-permissoes.ts sobre por que isso
  // garante efeito imediato de qualquer mudanca de cargo/permissao, sem
  // relogar.
  const permissoes = await resolverPermissoesEfetivas(
    sessaoCentral.usuarioCentralId,
    sessaoCentral.empresaId,
    papelEmpresa
  );

  const fusoHorario = await resolverFusoHorarioTenant(prisma);

  return {
    usuarioOperacional,
    usuarioCentralId: sessaoCentral.usuarioCentralId,
    empresaId: sessaoCentral.empresaId,
    empresaSlug: sessaoCentral.empresaSlug,
    tenantId: sessaoCentral.tenantId,
    tenantSlug: sessaoCentral.tenantSlug,
    connectionRef: sessaoCentral.connectionRef,
    // Direto da sessao central, nunca contaminado pelo Usuario.role do tenant.
    papelEmpresa,
    permissoes,
    fusoHorario,
    prisma,
  };
}
