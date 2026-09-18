// npx tsx scripts/dev/verificar-escopos.mjs [--empresa <slug>]
//
// SOMENTE LEITURA. Prova o escopo de visibilidade (Fase 1D-2, Parte 3) DIRETO
// no banco, sem confiar so na leitura do codigo: para cada usuario ATIVO da
// empresa, monta o mesmo ContextoTenantSeguro que exigirContextoTenant()
// construiria em producao e chama as MESMAS funcoes de lib/auth/escopos.ts —
// nunca reimplementa um `where` aqui. O numero "com escopo" vem de
// `prisma.<model>.count({ where: escopoX(contexto) })`; "sem escopo" vem da
// mesma consulta sem filtro nenhum (o total real da tabela).
//
// Roda com `npx tsx`, NAO com `node` puro: lib/auth/escopos.ts importa via
// alias "@/..." do tsconfig (como o resto do app, resolvido pelo bundler do
// Next), e o loader ESM nativo do Node nao resolve esse alias. tsx le o
// mesmo tsconfig.json e resolve "@/..." como o Next resolveria — ver a nota
// no fim deste arquivo para o porque disso ser um problema de tooling, nao
// so um detalhe de como rodar o script.
import "dotenv/config";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import {
  escopoOrdemServico,
  escopoCaixaSession,
  escopoContaReceber,
  escopoDespesa,
} from "@/lib/auth/escopos";
import { resolverPermissoesEfetivas } from "@/lib/auth/resolver-permissoes";
import { ehPapelEmpresa } from "@/lib/auth/permissoes";
import { extrairHostMascarado, mascararConnectionString, recusarPooler } from "../lib/conexao-somente-leitura.mjs";
import { listarTenantsAtivos, lerCentralDatabaseUrl, imprimirAusenciaDeAmbiente } from "../lib/tenants-centrais.mjs";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

function lerArgumentos(argv) {
  const valores = {};
  for (let indice = 0; indice < argv.length; indice += 1) {
    const atual = argv[indice];
    if (atual.startsWith("--")) {
      valores[atual.slice(2)] = argv[indice + 1];
      indice += 1;
    }
  }
  return valores;
}

async function travarSomenteLeitura(prisma, rotulo) {
  await prisma.$executeRawUnsafe("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  await prisma.$executeRawUnsafe("SET default_transaction_read_only = on");

  const [sessao] = await prisma.$queryRawUnsafe('SHOW transaction_read_only');
  const [padrao] = await prisma.$queryRawUnsafe('SHOW default_transaction_read_only');

  if (sessao.transaction_read_only !== "on" || padrao.default_transaction_read_only !== "on") {
    throw new Error(`${rotulo}: nao foi possivel travar a sessao em somente-leitura. Abortando.`);
  }
}

function formatarSimNao(valor) {
  return valor ? "sim" : "nao";
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2));
  const empresaSlugFiltro = args.empresa ?? "konext-principal";

  const centralDatabaseUrl = lerCentralDatabaseUrl();
  if (!centralDatabaseUrl) {
    imprimirAusenciaDeAmbiente();
    process.exit(1);
  }
  recusarPooler(centralDatabaseUrl, "CENTRAL_DATABASE_URL");

  const { resolvidos, pulados } = await listarTenantsAtivos(centralDatabaseUrl);
  const alvo = resolvidos.find((tenant) => tenant.empresaSlug === empresaSlugFiltro);

  if (!alvo) {
    console.error(`[erro] Nenhum tenant ativo encontrado para a empresa "${empresaSlugFiltro}".`);
    console.error(`[erro] Tenants ativos disponiveis: ${resolvidos.map((t) => t.empresaSlug).join(", ") || "(nenhum)"}`);
    if (pulados.length > 0) {
      console.error(`[aviso] ${pulados.length} tenant(s) pulados: ${pulados.map((p) => p.slug).join(", ")}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("Verificacao de escopos de visibilidade (Fase 1D-2, Parte 3) — somente leitura");
  console.log(`  Banco central : ${mascararConnectionString(centralDatabaseUrl)}`);
  console.log(`  Host central  : ${extrairHostMascarado(centralDatabaseUrl)}`);
  console.log(`  Empresa       : ${alvo.empresaSlug}`);
  console.log(`  Host tenant   : ${extrairHostMascarado(alvo.connectionString)}`);
  console.log("");

  const prismaCentral = new PrismaCentral({
    adapter: new PrismaNeon({ connectionString: centralDatabaseUrl }),
    log: ["error"],
  });
  const prismaTenant = new PrismaOperacional({
    adapter: new PrismaNeon({ connectionString: alvo.connectionString }),
    log: ["error"],
  });

  try {
    await travarSomenteLeitura(prismaCentral, "banco central");
    await travarSomenteLeitura(prismaTenant, "banco do tenant");

    const vinculos = await prismaCentral.usuarioEmpresa.findMany({
      where: { empresaId: alvo.empresaId, ativo: true },
      select: {
        usuarioId: true,
        role: true,
        usuario: { select: { email: true, nome: true } },
        cargo: { select: { nome: true } },
      },
      orderBy: { usuario: { nome: "asc" } },
    });

    const [totalOS, totalCaixa, totalReceber, totalDespesa] = await Promise.all([
      prismaTenant.ordemServico.count(),
      prismaTenant.caixaSession.count(),
      prismaTenant.contaReceber.count(),
      prismaTenant.despesa.count(),
    ]);

    const linhas = [];
    const inconsistencias = [];

    for (const vinculo of vinculos) {
      const emailNormalizado = vinculo.usuario.email.trim().toLowerCase();
      const usuarioTenant = await prismaTenant.usuario.findUnique({
        where: { email: emailNormalizado },
        select: { id: true, nome: true },
      });

      const papel = ehPapelEmpresa(vinculo.role) ? vinculo.role : "USUARIO";
      const permissoes = await resolverPermissoesEfetivas(vinculo.usuarioId, alvo.empresaId, papel);
      const cargoRotulo = vinculo.cargo?.nome ?? `(legado: ${vinculo.role})`;

      // Sem Usuario do tenant mapeado por e-mail: simula exatamente o contexto
      // que exigirContextoTenant produziria nesse caso (usuarioOperacional.id
      // vazio) para provar que o fail-closed de lib/auth/escopos.ts funciona
      // de verdade, e nao so "no papel".
      const contexto = {
        usuarioOperacional: { id: usuarioTenant?.id ?? "", nome: usuarioTenant?.nome ?? "", email: emailNormalizado, role: "" },
        usuarioCentralId: vinculo.usuarioId,
        empresaId: alvo.empresaId,
        empresaSlug: alvo.empresaSlug,
        tenantId: alvo.id,
        tenantSlug: alvo.slug,
        connectionRef: alvo.connectionRef,
        papelEmpresa: papel,
        permissoes,
      };

      const [osComEscopo, caixaComEscopo, receberComEscopo, despesaComEscopo] = await Promise.all([
        prismaTenant.ordemServico.count({ where: escopoOrdemServico(contexto) }),
        prismaTenant.caixaSession.count({ where: escopoCaixaSession(contexto) }),
        prismaTenant.contaReceber.count({ where: escopoContaReceber(contexto) }),
        prismaTenant.despesa.count({ where: escopoDespesa(contexto) }),
      ]);

      const temOsVerTodas = permissoes.has("os.ver_todas");
      const temCaixaVerTodos = permissoes.has("caixa.ver_todos");
      const temFinanceiroVerTodos = permissoes.has("financeiro.ver_todos");

      // Checagem independente: sem tecnico atribuido em nenhuma OS ainda,
      // um usuario RESTRITO (sem os.ver_todas) so deveria ver o que ELE
      // criou — conferido aqui direto por criadoPorId, sem passar por
      // escopoOrdemServico, pra nao validar a funcao contra ela mesma.
      //
      // O fail-closed (usuarioOperacional.id vazio -> nunca bate nada) so
      // importa pra quem NAO tem a permissao "_todas": quem tem, recebe `{}`
      // ja na primeira linha de cada funcao de escopo, antes de qualquer
      // checagem de usuarioOperacional — reflete o proprio codigo de
      // lib/auth/escopos.ts, entao testar fail-closed num usuario
      // irrestrito seria um falso positivo deste script, nao um bug do app.
      let observacao = "";
      if (!usuarioTenant) {
        const deveriaSerZero = {
          os: !temOsVerTodas,
          caixa: !temCaixaVerTodos,
          receber: !temFinanceiroVerTodos,
          despesa: !temFinanceiroVerTodos,
        };
        const falhas = [];
        if (deveriaSerZero.os && osComEscopo !== 0) falhas.push(`OS=${osComEscopo}`);
        if (deveriaSerZero.caixa && caixaComEscopo !== 0) falhas.push(`Caixa=${caixaComEscopo}`);
        if (deveriaSerZero.receber && receberComEscopo !== 0) falhas.push(`Receber=${receberComEscopo}`);
        if (deveriaSerZero.despesa && despesaComEscopo !== 0) falhas.push(`Despesa=${despesaComEscopo}`);

        if (falhas.length > 0) {
          inconsistencias.push(
            `${vinculo.usuario.email}: sem Usuario mapeado no tenant e sem a permissao "_todas" correspondente, mas o escopo devolveu resultado > 0 (fail-closed quebrado): ${falhas.join(", ")}.`
          );
          observacao = "FALHOU fail-closed";
        } else {
          observacao = "sem usuario no tenant (as areas restritas sem permissao deram 0, como esperado)";
        }
      } else if (!temOsVerTodas) {
        // escopoOrdemServico e OR de duas fontes (criadoPorId / TecnicoOS) —
        // pra nao reimplementar esse OR aqui, busco os ids de cada fonte
        // SEPARADAMENTE (duas queries simples, sem nenhuma decisao de
        // negocio) e uno em memoria com um Set; so a contagem de tamanho e
        // comparada com o resultado real da funcao de escopo.
        const [osCriadasPorMim, osComoTecnico] = await Promise.all([
          prismaTenant.ordemServico.findMany({ where: { criadoPorId: usuarioTenant.id }, select: { id: true } }),
          prismaTenant.tecnicoOS.findMany({ where: { usuarioId: usuarioTenant.id }, select: { osId: true } }),
        ]);
        const idsEsperados = new Set([
          ...osCriadasPorMim.map((os) => os.id),
          ...osComoTecnico.map((tecnico) => tecnico.osId),
        ]);

        if (idsEsperados.size !== osComEscopo) {
          inconsistencias.push(
            `${vinculo.usuario.email}: escopo de OS devolveu ${osComEscopo}, mas a uniao (criadas por ele + TecnicoOS) da ${idsEsperados.size}.`
          );
          observacao = "DIVERGENTE da uniao criadoPorId+TecnicoOS";
        } else if (osComoTecnico.length > 0) {
          observacao = `OK (${osComoTecnico.length} como tecnico, ${osCriadasPorMim.length} criada(s))`;
        }
      }

      linhas.push({
        nome: usuarioTenant?.nome ?? vinculo.usuario.nome,
        email: vinculo.usuario.email,
        cargo: cargoRotulo,
        osVerTodas: formatarSimNao(temOsVerTodas),
        caixaVerTodos: formatarSimNao(temCaixaVerTodos),
        financeiroVerTodos: formatarSimNao(temFinanceiroVerTodos),
        os: `${osComEscopo}/${totalOS}`,
        caixa: `${caixaComEscopo}/${totalCaixa}`,
        receber: `${receberComEscopo}/${totalReceber}`,
        despesa: `${despesaComEscopo}/${totalDespesa}`,
        observacao,
      });
    }

    console.log("| Usuário | Cargo | os.ver_todas | caixa.ver_todos | financeiro.ver_todos | OS (com/sem escopo) | Caixa (com/sem) | Receber (com/sem) | Despesa (com/sem) | Observação |");
    console.log("|---|---|---|---|---|---|---|---|---|---|");
    for (const linha of linhas) {
      console.log(
        `| ${linha.nome} (${linha.email}) | ${linha.cargo} | ${linha.osVerTodas} | ${linha.caixaVerTodos} | ${linha.financeiroVerTodos} | ${linha.os} | ${linha.caixa} | ${linha.receber} | ${linha.despesa} | ${linha.observacao || "-"} |`
      );
    }

    console.log("");

    // Nenhum dos 4 campos novos (criadoPorId/abertoPorId) teve backfill —
    // isso e proposital (Parte 1), mas significa que "usuario restrito ve 0
    // de N" pode ser tanto o escopo funcionando quanto o escopo NAO
    // filtrando nada relevante, porque a coluna em si esta vazia em toda
    // linha existente. Reporta isso explicitamente em vez de deixar o
    // numero falar sozinho.
    const [osComCriador, caixaComAbridor, receberComCriador, despesaComCriador, totalTecnicoOS] = await Promise.all([
      prismaTenant.ordemServico.count({ where: { criadoPorId: { not: null } } }),
      prismaTenant.caixaSession.count({ where: { abertoPorId: { not: null } } }),
      prismaTenant.contaReceber.count({ where: { criadoPorId: { not: null } } }),
      prismaTenant.despesa.count({ where: { criadoPorId: { not: null } } }),
      prismaTenant.tecnicoOS.count(),
    ]);

    console.log("Cobertura dos campos novos (sem backfill, por desenho da Parte 1):");
    console.log(`  OrdemServico.criadoPorId preenchido : ${osComCriador}/${totalOS}`);
    console.log(`  CaixaSession.abertoPorId preenchido  : ${caixaComAbridor}/${totalCaixa}`);
    console.log(`  ContaReceber.criadoPorId preenchido  : ${receberComCriador}/${totalReceber}`);
    console.log(`  Despesa.criadoPorId preenchido       : ${despesaComCriador}/${totalDespesa}`);
    console.log(`  TecnicoOS (linhas no total)          : ${totalTecnicoOS}`);
    console.log("");

    const camposVazios = osComCriador === 0 && caixaComAbridor === 0 && receberComCriador === 0 && despesaComCriador === 0;
    if (camposVazios) {
      console.log(
        "AVISO: os 4 campos estao 100% vazios agora. Um usuario restrito ver \"0 de N\" e CONSISTENTE com o escopo " +
        "funcionando, mas tambem seria identico ao resultado se o filtro nao fizesse nada (a coluna filtrada esta " +
        "sempre nula em toda a tabela). A prova sintetica abaixo fecha essa lacuna sem escrever no banco: mostra " +
        "que o mesmo usuario, com a mesma consulta, muda de \"ve tudo\" pra \"ve 0\" quando a permissao \"_todas\" " +
        "e removida em memoria — ou seja, o WHERE realmente reduz o conjunto, e nao e so uma coincidencia de dado vazio."
      );
      console.log("");
    }

    // Prova sintetica (nao escreve nada): pega um usuario real que hoje TEM
    // as 3 permissoes "_todas"/"_todos" e roda escopoX duas vezes — uma com
    // o Set de permissoes real, outra com uma COPIA em memoria sem essas 3
    // permissoes. Se o total cair de N pra 0 nos dois casos, o WHERE do
    // Prisma esta de fato sendo montado e aplicado — nao reimplementa nada
    // de lib/auth/escopos.ts, so chama a mesma funcao com um contexto
    // diferente.
    let usuarioIrrestrito = null;
    for (const vinculo of vinculos) {
      const papelCandidato = ehPapelEmpresa(vinculo.role) ? vinculo.role : "USUARIO";
      const permissoesCandidato = await resolverPermissoesEfetivas(vinculo.usuarioId, alvo.empresaId, papelCandidato);
      if (
        permissoesCandidato.has("os.ver_todas")
        && permissoesCandidato.has("caixa.ver_todos")
        && permissoesCandidato.has("financeiro.ver_todos")
      ) {
        usuarioIrrestrito = vinculo;
        break;
      }
    }

    if (!usuarioIrrestrito) {
      console.log("Prova sintetica pulada: nenhum usuario ativo tem as 3 permissoes \"_todas\"/\"_todos\" ao mesmo tempo hoje.");
      console.log("");
    } else {
      const emailNormalizado = usuarioIrrestrito.usuario.email.trim().toLowerCase();
      const usuarioTenant = await prismaTenant.usuario.findUnique({
        where: { email: emailNormalizado },
        select: { id: true, nome: true },
      });
      const papel = ehPapelEmpresa(usuarioIrrestrito.role) ? usuarioIrrestrito.role : "USUARIO";
      const permissoesReais = await resolverPermissoesEfetivas(usuarioIrrestrito.usuarioId, alvo.empresaId, papel);
      const permissoesSemTodas = new Set([...permissoesReais].filter((p) => !p.endsWith("_todas") && !p.endsWith("_todos")));

      const contextoIrrestrito = {
        usuarioOperacional: { id: usuarioTenant?.id ?? "", nome: usuarioTenant?.nome ?? "", email: emailNormalizado, role: "" },
        usuarioCentralId: usuarioIrrestrito.usuarioId,
        empresaId: alvo.empresaId,
        empresaSlug: alvo.empresaSlug,
        tenantId: alvo.id,
        tenantSlug: alvo.slug,
        connectionRef: alvo.connectionRef,
        papelEmpresa: papel,
        permissoes: permissoesReais,
      };
      const contextoSimuladoRestrito = { ...contextoIrrestrito, permissoes: permissoesSemTodas };

      const [osIrrestrito, osRestritoSimulado] = await Promise.all([
        prismaTenant.ordemServico.count({ where: escopoOrdemServico(contextoIrrestrito) }),
        prismaTenant.ordemServico.count({ where: escopoOrdemServico(contextoSimuladoRestrito) }),
      ]);
      const [caixaIrrestrito, caixaRestritoSimulado] = await Promise.all([
        prismaTenant.caixaSession.count({ where: escopoCaixaSession(contextoIrrestrito) }),
        prismaTenant.caixaSession.count({ where: escopoCaixaSession(contextoSimuladoRestrito) }),
      ]);
      const [receberIrrestrito, receberRestritoSimulado] = await Promise.all([
        prismaTenant.contaReceber.count({ where: escopoContaReceber(contextoIrrestrito) }),
        prismaTenant.contaReceber.count({ where: escopoContaReceber(contextoSimuladoRestrito) }),
      ]);

      console.log(`Prova sintetica (usuario real: ${usuarioIrrestrito.usuario.email}, sem escrever no banco):`);
      console.log(`  OS      : com "_todas" real = ${osIrrestrito} | mesma consulta sem "_todas" (em memoria) = ${osRestritoSimulado}`);
      console.log(`  Caixa   : com "_todos" real = ${caixaIrrestrito} | mesma consulta sem "_todos" (em memoria) = ${caixaRestritoSimulado}`);
      console.log(`  Receber : com "_todos" real = ${receberIrrestrito} | mesma consulta sem "_todos" (em memoria) = ${receberRestritoSimulado}`);

      const reduziu = osRestritoSimulado < osIrrestrito || caixaRestritoSimulado < caixaIrrestrito || receberRestritoSimulado < receberIrrestrito;
      if (!reduziu) {
        inconsistencias.push(
          "Prova sintetica: remover as permissoes \"_todas\"/\"_todos\" em memoria NAO reduziu nenhuma contagem — o WHERE do Prisma pode nao estar sendo aplicado de verdade."
        );
        console.log("  RESULTADO: nao reduziu nada — investigar.");
      } else {
        console.log("  RESULTADO: reduziu como esperado — o WHERE do escopo esta de fato sendo aplicado pelo Prisma.");
      }
      console.log("");
    }

    if (inconsistencias.length === 0) {
      console.log("Nenhuma inconsistencia encontrada: todo escopo restrito bateu com a checagem independente e com a prova sintetica.");
    } else {
      console.log(`${inconsistencias.length} inconsistencia(s) encontrada(s):`);
      for (const inconsistencia of inconsistencias) {
        console.log(`  - ${inconsistencia}`);
      }
    }
    console.log("");
  } finally {
    await prismaTenant.$disconnect();
    await prismaCentral.$disconnect();
  }
}

main().catch((erro) => {
  console.error("");
  console.error(`[erro] ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});

// NOTA DE TOOLING (achado deste script, nao uma decisao de projeto): todo
// outro script em scripts/ que precisa de logica do app importa modulos
// puros via caminho RELATIVO com extensao ".ts" (ex.: lib/auth/cargos-padrao.ts,
// lib/dominio/os/regras-finalizacao.ts) porque esses modulos foram escritos
// de proposito sem nenhum import "@/...". lib/auth/escopos.ts nao seguiu essa
// convencao — importa `@/lib/auth/permissoes` e `@/types/tenant` — entao
// `node scripts/dev/verificar-escopos.mjs` puro nao consegue carrega-lo
// (ERR_MODULE_NOT_FOUND). Rodar via `npx tsx`, que resolve "@/..." pelo
// tsconfig.json do proprio projeto, evita reimplementar o filtro a mao (o
// que Parte 2 deste pedido proibe explicitamente), mas e uma dependencia de
// tooling nova neste projeto (nao esta em package.json) so para ESTE script.
// Se scripts/dev/ passar a precisar disso com frequencia, vale reavaliar:
// ou todo modulo em lib/auth/ ganha a mesma disciplina de import relativo de
// lib/auth/cargos-padrao.ts, ou tsx vira dependencia declarada do projeto.
