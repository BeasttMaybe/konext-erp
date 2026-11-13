import type { PrismaClient } from "@prisma/client";
import type { PapelEmpresa, Permissao } from "@/lib/auth/permissoes";
import type { IdModulo } from "@/lib/modulos/catalogo";

export type UsuarioOperacionalTenant = {
  id: string;
  nome: string;
  email: string;
  role: string;
};

export type ContextoTenantSeguro = {
  usuarioOperacional: UsuarioOperacionalTenant;
  usuarioCentralId: string;
  empresaId: string;
  empresaSlug: string;
  tenantId: string;
  tenantSlug: string;
  connectionRef: string;
  /**
   * Papel do vinculo UsuarioEmpresa no banco CENTRAL (ADMIN/GESTOR/USUARIO).
   *
   * Existe separado de `usuarioOperacional.role` de proposito: aquele campo
   * reflete `Usuario.role` do banco do TENANT (ADMIN/OPERADOR/TECNICO) quando
   * ha correspondencia por e-mail, e so cai para o papel central quando nao ha
   * usuario operacional mapeado. Sao dois vocabularios diferentes que nunca
   * deveriam ser misturados para autorizacao (AUDIT_REPORT F-01, §7.5).
   * Toda decisao de permissao usa `papelEmpresa`, nunca `usuarioOperacional.role`.
   */
  papelEmpresa: PapelEmpresa;
  /**
   * Permissoes efetivas do Cargo do usuario (Fase 1D-1), resolvidas uma vez
   * por requisicao em exigirContextoTenant — ver
   * lib/auth/resolver-permissoes.ts. Opcional so pra nao quebrar um
   * ContextoTenantSeguro montado a mao (teste/script antigo); toda chamada
   * real de exigirContextoTenant sempre preenche.
   */
  permissoes?: ReadonlySet<Permissao>;
  /**
   * Modulos contratados pela loja (lib/modulos/catalogo.ts). `permissoes`
   * acima ja vem sem as dos modulos desligados.
   */
  modulosAtivos?: ReadonlySet<IdModulo>;
  /**
   * Fuso horário da loja (`Configuracao.fusoHorario`, Fase 2A-1), resolvido
   * uma vez por requisicao em exigirContextoTenant — ver lib/datas.ts, o
   * unico modulo autorizado a usar isto pra calcular fronteira de
   * dia/semana/mes. Opcional só pra nao quebrar um ContextoTenantSeguro
   * montado a mao (teste/script antigo), mesma decisao de `permissoes`
   * acima; toda chamada real de exigirContextoTenant sempre preenche (cai
   * pro default do schema, America/Sao_Paulo, quando a linha de
   * Configuracao nao existe ou o valor esta vazio). Quem le, le com
   * `contexto.fusoHorario ?? FUSO_HORARIO_PADRAO` (lib/datas.ts).
   */
  fusoHorario?: string;
};

export type ContextoTenantServidor = ContextoTenantSeguro & {
  prisma: PrismaClient;
};
