// Import relativo de proposito (nao "@/..."): este modulo e importado
// diretamente por scripts .mjs (scripts/provisionar-tenant-*.mjs) via
// `node script.mjs`, sem bundler nem resolucao de alias de tsconfig — so
// import relativo funciona nesse caminho de execucao.
import { CARGOS_PADRAO, type NomeCargoPadrao } from "../auth/cargos-padrao.ts";

/**
 * Cria os 5 cargos padrao (definidos em lib/auth/cargos-padrao.ts, a mesma
 * lista usada no backfill da migracao 20260918130000_cargos_permissoes) pra
 * uma empresa NOVA — extraido daquele backfill pra ser reusado por todo
 * caminho de criacao de empresa (Fase 1D-1, fecho): os scripts de
 * provisionamento (scripts/provisionar-tenant-*.mjs) e qualquer caminho
 * futuro de criacao de empresa.
 *
 * `tx` aceita tanto uma transacao (Prisma.TransactionClient) quanto o client
 * central direto — narrow de proposito pra so exigir `cargo.create`, o que
 * permite testar esta funcao sem banco (ver cargos-padrao.test.ts) e chamar
 * de dentro de scripts .mjs que importam @prisma/client-central OU um client
 * criado localmente com outro adapter.
 */
export type ClienteCargoParaProvisionamento = {
  cargo: {
    create: (args: {
      data: {
        empresaId: string;
        nome: string;
        descricao: string | null;
        fixo: boolean;
        permissoes: { create: { permissao: string }[] };
      };
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
};

export type MapaCargosPadraoCriados = Readonly<Record<NomeCargoPadrao, string>>;

export async function criarCargosPadrao(
  empresaId: string,
  tx: ClienteCargoParaProvisionamento
): Promise<MapaCargosPadraoCriados> {
  const resultado: Partial<Record<NomeCargoPadrao, string>> = {};

  for (const definicao of CARGOS_PADRAO) {
    const cargo = await tx.cargo.create({
      data: {
        empresaId,
        nome: definicao.nome,
        descricao: definicao.descricao,
        fixo: definicao.fixo,
        permissoes: { create: definicao.permissoes.map((permissao) => ({ permissao })) },
      },
      select: { id: true },
    });

    resultado[definicao.nome] = cargo.id;
  }

  return resultado as MapaCargosPadraoCriados;
}
