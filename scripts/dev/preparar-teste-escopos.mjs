// node scripts/dev/preparar-teste-escopos.mjs [--empresa <slug>]
//
// ESCREVE no banco (so tenant de TESTE). Prepara um cenario pro dono clicar
// e conferir a olho o escopo de visibilidade da Fase 1D-2 — Parte 3:
//   1. garante dois usuarios de teste, um com o cargo "Técnico" e outro com
//      "Atendente" (cria se nao existirem; senha aleatoria impressa uma vez
//      so no console, nunca gravada em arquivo nem no repositorio);
//   2. atribui os DOIS como tecnicos de UMA OS existente, 50/50, um deles
//      principal (via lib/dominio/os/tecnicos.ts — a mesma regra que
//      definirTecnicosOS usa, nunca reimplementada aqui);
//   3. atribui UM tecnico sozinho (100%, principal) a OUTRA OS existente.
//
// So roda com AMBIENTE="teste" no .env (mesma trava de
// scripts/dev/criar-usuario-teste.mjs), e so escreve se CONFIRMAR=SIM. Sem
// CONFIRMAR=SIM, so imprime o plano (quais usuarios, quais OS) e nao toca
// no banco.
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient as PrismaCentral } from "@prisma/client-central";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { gerarHashSenha, validarNovaSenha } from "../../lib/auth/senha.ts";
import { resolverTecnicos } from "../../lib/dominio/os/tecnicos.ts";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "../../lib/auditoria-constantes.ts";
import { extrairHostMascarado, mascararConnectionString, recusarPooler } from "../lib/conexao-somente-leitura.mjs";
import { validarConnectionRefTenant } from "../lib/tenants-centrais.mjs";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

// roleTenant e so cosmetico (Usuario.role do tenant nunca autoriza nada —
// ver types/tenant.ts); mantido por consistencia visual com o cargo real.
const CARGOS_ALVO = [
  { nomeCargo: "Técnico", email: "tecnico.escopos.teste@konext.local", nome: "Técnico Teste Escopos", roleTenant: "TECNICO" },
  { nomeCargo: "Atendente", email: "atendente.escopos.teste@konext.local", nome: "Atendente Teste Escopos", roleTenant: "OPERADOR" },
];

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

function exigirAmbienteTeste() {
  if (process.env.AMBIENTE === "teste") return;

  console.error("");
  console.error('[erro] Este script so roda com AMBIENTE="teste" definido no seu .env.');
  console.error(`[erro] AMBIENTE atual: ${JSON.stringify(process.env.AMBIENTE ?? null)}`);
  console.error("[erro] Isso existe para nunca criar dados de teste sem querer em producao.");
  console.error("");
  process.exit(1);
}

/** Senha aleatoria que ja bate com validarNovaSenha (letras + numeros, >= 8 chars). */
function gerarSenhaAleatoria() {
  const senha = `Teste-${crypto.randomBytes(6).toString("hex")}`;
  const validacao = validarNovaSenha(senha);
  if (!validacao.valida) {
    throw new Error(`Senha gerada nao passou na propria validacao (${validacao.motivo}) — bug neste script.`);
  }
  return senha;
}

async function main() {
  exigirAmbienteTeste();

  const args = lerArgumentos(process.argv.slice(2));
  const empresaSlug = args.empresa ?? "konext-principal";

  const centralDatabaseUrl = process.env.CENTRAL_DATABASE_URL;
  if (!centralDatabaseUrl || !centralDatabaseUrl.trim()) {
    throw new Error("CENTRAL_DATABASE_URL nao definida no seu .env.");
  }
  recusarPooler(centralDatabaseUrl, "CENTRAL_DATABASE_URL");

  console.log("");
  console.log("Preparar cenario de teste — escopos de visibilidade (Fase 1D-2)");
  console.log(`  Ambiente      : ${process.env.AMBIENTE}`);
  console.log(`  Banco central : ${mascararConnectionString(centralDatabaseUrl)}`);
  console.log(`  Host central  : ${extrairHostMascarado(centralDatabaseUrl)}`);
  console.log(`  Empresa       : ${empresaSlug}`);
  console.log("");

  const prismaCentral = new PrismaCentral({
    adapter: new PrismaNeon({ connectionString: centralDatabaseUrl }),
    log: ["error"],
  });

  try {
    const empresa = await prismaCentral.empresa.findUnique({
      where: { slug: empresaSlug },
      select: { id: true, slug: true, status: true },
    });
    if (!empresa) throw new Error(`Empresa com slug "${empresaSlug}" nao encontrada no banco central.`);
    if (empresa.status !== "ATIVA") throw new Error(`Empresa "${empresaSlug}" nao esta ATIVA (status atual: ${empresa.status}).`);

    const tenant = await prismaCentral.tenant.findFirst({
      where: { empresaId: empresa.id, status: "ATIVO" },
      select: { id: true, slug: true, connectionRef: true },
    });
    if (!tenant) throw new Error(`Nenhum tenant ATIVO encontrado para a empresa "${empresaSlug}".`);

    const connectionRef = validarConnectionRefTenant(tenant.connectionRef);
    const tenantDatabaseUrl = process.env[connectionRef];
    if (!tenantDatabaseUrl || !tenantDatabaseUrl.trim()) {
      throw new Error(`Variavel de ambiente ${connectionRef} nao definida no seu .env.`);
    }
    recusarPooler(tenantDatabaseUrl, connectionRef);

    console.log(`  Host tenant   : ${extrairHostMascarado(tenantDatabaseUrl)}`);
    console.log("");

    const cargos = await prismaCentral.cargo.findMany({
      where: { empresaId: empresa.id, nome: { in: CARGOS_ALVO.map((c) => c.nomeCargo) }, arquivadoEm: null },
      select: { id: true, nome: true },
    });
    const cargoPorNome = new Map(cargos.map((c) => [c.nome, c.id]));
    const faltando = CARGOS_ALVO.filter((c) => !cargoPorNome.has(c.nomeCargo));
    if (faltando.length > 0) {
      throw new Error(
        `Cargo(s) padrao ausente(s) nesta empresa: ${faltando.map((c) => c.nomeCargo).join(", ")}. ` +
          "Esperado que toda empresa nasca com os 5 cargos padrao (Fase 1D-1, lib/central/cargos-padrao.ts)."
      );
    }

    const prismaTenant = new PrismaOperacional({
      adapter: new PrismaNeon({ connectionString: tenantDatabaseUrl }),
      log: ["error"],
    });

    try {
      const osCandidatas = await prismaTenant.ordemServico.findMany({
        where: { excluidaEm: null, tecnicos: { none: {} } },
        select: { id: true, numeroOs: true },
        orderBy: { numeroOs: "asc" },
        take: 2,
      });

      if (osCandidatas.length < 2) {
        throw new Error(
          `Preciso de pelo menos 2 OS ativas sem tecnico atribuido pra montar o cenario; encontrei ${osCandidatas.length}.`
        );
      }

      const [osDupla, osSolo] = osCandidatas;

      const senhasGeradas = CARGOS_ALVO.map((alvo) => ({ ...alvo, senha: gerarSenhaAleatoria() }));

      console.log("Plano:");
      for (const alvo of senhasGeradas) {
        console.log(`  - Usuario "${alvo.nome}" <${alvo.email}>, cargo "${alvo.nomeCargo}"`);
      }
      console.log(`  - OS #${osDupla.numeroOs} (${osDupla.id}): os dois usuarios acima, 50/50, um principal`);
      console.log(`  - OS #${osSolo.numeroOs} (${osSolo.id}): so o usuario "Técnico Teste Escopos", 100%, principal`);
      console.log("");

      if (process.env.CONFIRMAR !== "SIM") {
        console.log("Nada foi alterado. Para confirmar, rode de novo com CONFIRMAR=SIM.");
        console.log("");
        return;
      }

      const usuariosCriados = [];

      for (const alvo of senhasGeradas) {
        const senhaHash = await gerarHashSenha(alvo.senha);

        const usuarioCentral = await prismaCentral.usuarioCentral.upsert({
          where: { email: alvo.email },
          update: { senha: senhaHash, ativo: true },
          create: { nome: alvo.nome, email: alvo.email, senha: senhaHash, ativo: true },
          select: { id: true },
        });

        await prismaCentral.usuarioEmpresa.upsert({
          where: { usuarioId_empresaId: { usuarioId: usuarioCentral.id, empresaId: empresa.id } },
          update: { role: "USUARIO", cargoId: cargoPorNome.get(alvo.nomeCargo), ativo: true },
          create: {
            usuarioId: usuarioCentral.id,
            empresaId: empresa.id,
            role: "USUARIO",
            cargoId: cargoPorNome.get(alvo.nomeCargo),
            ativo: true,
          },
        });

        const usuarioTenantExistente = await prismaTenant.usuario.findUnique({
          where: { email: alvo.email },
          select: { id: true },
        });
        if (usuarioTenantExistente && usuarioTenantExistente.id !== usuarioCentral.id) {
          throw new Error(
            `Ja existe um Usuario neste tenant com o e-mail "${alvo.email}", mas com id diferente do ` +
              `UsuarioCentral (${usuarioTenantExistente.id} != ${usuarioCentral.id}). Apague essa linha manualmente ` +
              "(so em banco de teste) e rode de novo."
          );
        }

        await prismaTenant.usuario.upsert({
          where: { id: usuarioCentral.id },
          update: { nome: alvo.nome, email: alvo.email, senha: senhaHash, role: alvo.roleTenant },
          create: { id: usuarioCentral.id, nome: alvo.nome, email: alvo.email, senha: senhaHash, role: alvo.roleTenant },
        });

        usuariosCriados.push({ ...alvo, id: usuarioCentral.id });
      }

      const [usuarioTecnico, usuarioAtendente] = usuariosCriados;

      const resolucaoDupla = resolverTecnicos([{ usuarioId: usuarioTecnico.id }, { usuarioId: usuarioAtendente.id }]);
      if (!resolucaoDupla.sucesso) throw new Error(`Falha ao resolver tecnicos da OS dupla: ${resolucaoDupla.erro}`);

      const resolucaoSolo = resolverTecnicos([{ usuarioId: usuarioTecnico.id }]);
      if (!resolucaoSolo.sucesso) throw new Error(`Falha ao resolver tecnico da OS solo: ${resolucaoSolo.erro}`);

      await prismaTenant.$transaction(async (tx) => {
        await tx.tecnicoOS.deleteMany({ where: { osId: { in: [osDupla.id, osSolo.id] } } });

        await tx.tecnicoOS.createMany({
          data: [
            ...resolucaoDupla.tecnicos.map((tecnico) => ({
              osId: osDupla.id,
              usuarioId: tecnico.usuarioId,
              participacaoPercentual: tecnico.participacaoPercentual,
              principal: tecnico.principal,
            })),
            ...resolucaoSolo.tecnicos.map((tecnico) => ({
              osId: osSolo.id,
              usuarioId: tecnico.usuarioId,
              participacaoPercentual: tecnico.participacaoPercentual,
              principal: tecnico.principal,
            })),
          ],
        });

        await tx.logAuditoria.create({
          data: {
            usuarioId: null,
            origem: "scripts/dev/preparar-teste-escopos.mjs",
            acao: ACOES_AUDITORIA.DEFINIR_TECNICOS_OS,
            entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
            entidadeId: osDupla.id,
            dadosAntes: { tecnicos: [] },
            dadosDepois: { tecnicos: resolucaoDupla.tecnicos },
            motivo: "scripts/dev/preparar-teste-escopos.mjs: cenario de teste da Fase 1D-2, Parte 3",
          },
        });
        await tx.logAuditoria.create({
          data: {
            usuarioId: null,
            origem: "scripts/dev/preparar-teste-escopos.mjs",
            acao: ACOES_AUDITORIA.DEFINIR_TECNICOS_OS,
            entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
            entidadeId: osSolo.id,
            dadosAntes: { tecnicos: [] },
            dadosDepois: { tecnicos: resolucaoSolo.tecnicos },
            motivo: "scripts/dev/preparar-teste-escopos.mjs: cenario de teste da Fase 1D-2, Parte 3",
          },
        });
      });

      console.log("Cenario criado com sucesso.");
      console.log("");
      console.log("Credenciais (anote agora — nao ficam salvas em nenhum arquivo nem log):");
      for (const alvo of senhasGeradas) {
        console.log(`  ${alvo.nomeCargo.padEnd(10)} : ${alvo.email} / ${alvo.senha}`);
      }
      console.log("");
      console.log(`  OS #${osDupla.numeroOs}: ambos os usuarios, 50/50`);
      console.log(`  OS #${osSolo.numeroOs}: so "${usuarioTecnico.nome}", 100%`);
      console.log("");
    } finally {
      await prismaTenant.$disconnect();
    }
  } finally {
    await prismaCentral.$disconnect();
  }
}

main().catch((erro) => {
  console.error("");
  console.error(`[erro] ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("");
  process.exit(1);
});
