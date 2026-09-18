import "dotenv/config";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { CATALOGO_PERMISSOES, ehPermissao, permissoesDoPapel } from "../lib/auth/permissoes.ts";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

/**
 * Prova, direto do banco, que o backfill da migracao 20260918130000 nao
 * tirou nenhuma permissao de nenhum usuario existente (Fase 1D-1, fecho,
 * Parte 3): pra cada UsuarioEmpresa, compara o conjunto que a matriz legada
 * (lib/auth/permissoes.ts) concedia pro RoleEmpresa ANTES desta fase com o
 * conjunto que o Cargo atribuido concede AGORA, e imprime a diferenca
 * simetrica. Vazia em toda linha = ninguem perdeu nem ganhou nada fora do
 * esperado.
 */

function obterEnvObrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} nao definida.`);
  return valor;
}

function permissoesEfetivasDoCargo(cargo) {
  if (!cargo) return null;
  if (cargo.fixo) return new Set(CATALOGO_PERMISSOES);
  return new Set(cargo.permissoes.map((linha) => linha.permissao).filter(ehPermissao));
}

function diferencaSimetrica(a, b) {
  const soEmA = [...a].filter((item) => !b.has(item));
  const soEmB = [...b].filter((item) => !a.has(item));
  return { soEmA, soEmB };
}

async function executar() {
  const centralDatabaseUrl = obterEnvObrigatoria("CENTRAL_DATABASE_URL");

  if (centralDatabaseUrl.includes("-pooler")) {
    throw new Error("CENTRAL_DATABASE_URL aponta pra um endpoint -pooler. Use a conexao direta.");
  }

  const prismaCentral = new PrismaCentral({
    adapter: new PrismaNeon({ connectionString: centralDatabaseUrl }),
    log: ["error"],
  });

  try {
    const vinculos = await prismaCentral.usuarioEmpresa.findMany({
      select: {
        id: true,
        role: true,
        ativo: true,
        usuario: { select: { nome: true, email: true } },
        empresa: { select: { nome: true, slug: true } },
        cargo: {
          select: {
            nome: true,
            fixo: true,
            permissoes: { select: { permissao: true } },
          },
        },
      },
      orderBy: [{ empresa: { slug: "asc" } }, { usuario: { email: "asc" } }],
    });

    const linhas = vinculos.map((vinculo) => {
      const permissoesLegado = permissoesDoPapel(vinculo.role);
      const permissoesCargo = permissoesEfetivasDoCargo(vinculo.cargo);
      const diferenca = permissoesCargo
        ? diferencaSimetrica(permissoesLegado, permissoesCargo)
        : { soEmA: ["(SEM CARGO)"], soEmB: [] };

      return {
        empresa: vinculo.empresa.slug,
        usuario: vinculo.usuario.email,
        roleLegado: vinculo.role,
        cargoNovo: vinculo.cargo?.nome ?? "(nenhum)",
        perdeu: diferenca.soEmA.join(", ") || "—",
        ganhou: diferenca.soEmB.join(", ") || "—",
        diferencaVazia: diferenca.soEmA.length === 0,
      };
    });

    console.table(
      linhas.map((linha) => ({
        empresa: linha.empresa,
        usuario: linha.usuario,
        "role legado": linha.roleLegado,
        "cargo novo": linha.cargoNovo,
        "perdeu (legado - cargo)": linha.perdeu,
        "ganhou (cargo - legado, sem contar *_todas/*_todos)": linha.ganhou,
      }))
    );

    const comPerda = linhas.filter((linha) => !linha.diferencaVazia);

    console.log(`\nTotal de vinculos: ${linhas.length}`);
    console.log(`Vinculos que perderam alguma permissao: ${comPerda.length}`);

    if (comPerda.length > 0) {
      console.error("[verificar-paridade-cargos] FALHA: os vinculos acima perderam permissao no backfill.");
      process.exitCode = 1;
    } else {
      console.log("[verificar-paridade-cargos] OK: nenhum usuario perdeu permissao que tinha antes.");
    }
  } finally {
    await prismaCentral.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha desconhecida ao verificar paridade de cargos.");
  process.exit(1);
});
