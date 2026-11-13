import "server-only";

import path from "node:path";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient as PrismaDaLoja } from "@prisma/client";
import bcrypt from "bcryptjs";
import ws from "ws";

import { criarCargosPadrao } from "@erp/lib/central/cargos-padrao.ts";
import { gerarSenhaSugerida } from "@erp/lib/auth/senha-sugerida";
import { garantirClienteConsumidorFinal } from "@erp/lib/dominio/crm/consumidor-final";
import { aplicarMigracoes, listarMigracoes } from "@erp/lib/provisionamento/migracoes-da-loja";
import { abrirConexao, chaveDoCofre, guardarConexao, REF_DO_COFRE } from "@erp/lib/tenant/cofre-de-conexoes";
import { garantirBancoDaLoja, garantirProjetoDasLojas } from "~/lib/neon";
import { central } from "~/lib/prisma-central";
import { nomeNoBanco, validarLojaNova, type DadosDaLojaNova } from "~/lib/regras-loja-nova";

/**
 * CRIAR UMA LOJA NOVA — tudo que antes era feito a mao, em passos que podem
 * ser repetidos: se algo falhar no meio, "Continuar" refaz so o que falta.
 *
 *  1. Banco central: Empresa + Tenant (PROVISIONANDO, connectionRef "COFRE")
 *     + os 5 cargos padrao, numa transacao.
 *  2. Banco da loja no Neon (projeto konext-lojas, banco e papel proprios) e
 *     o endereco CIFRADO em ConexaoTenant.
 *  3. Migrations da loja (mesmo resultado do `prisma migrate deploy` — o CI
 *     prova).
 *  4. Conta do responsavel: no central (com cargo Administrador e como dono
 *     da loja) e no banco da loja; Configuracao inicial e Consumidor Final.
 *  5. Tenant ATIVO, com a versao do schema. So entao a loja consegue entrar.
 *
 * SENHA DO RESPONSAVEL: gerada aqui e devolvida UMA vez para a tela do master
 * — nunca gravada em claro. Se o e-mail ja tem conta em outra loja, a conta e
 * reaproveitada e a senha continua a dele.
 */

const CUSTO_HASH_SENHA = 12; // o mesmo de lib/auth/senha.ts no ERP

export type ResultadoDaCriacao =
  | { ok: true; empresaId: string; senhaTemporaria: string | null; email: string }
  | { ok: false; erro: string; empresaId?: string };

function pastaDasMigracoes(): string {
  // Na Vercel e localmente, o processo do master roda na pasta master/.
  return path.resolve(process.cwd(), "../prisma/migrations");
}

/** Local (so desenvolvimento): cria o banco no Postgres de MASTER_POSTGRES_LOCAL em vez do Neon. */
async function bancoDaLoja(nome: string): Promise<{ uri: string; projetoId: string | null }> {
  const local = process.env.MASTER_POSTGRES_LOCAL;
  if (local && !process.env.VERCEL) {
    const pool = new Pool({ connectionString: local });
    try {
      const { rows } = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [nome]);
      if (rows.length === 0) await pool.query(`CREATE DATABASE "${nome}"`);
    } finally {
      await pool.end();
    }
    const url = new URL(local);
    url.pathname = `/${nome}`;
    return { uri: url.toString(), projetoId: null };
  }
  const projeto = await garantirProjetoDasLojas();
  return { uri: await garantirBancoDaLoja(projeto, nome), projetoId: projeto.projetoId };
}

function prepararWebSocket() {
  if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
}

export async function criarOuContinuarLoja(dados: DadosDaLojaNova, administradorId: string): Promise<ResultadoDaCriacao> {
  const problema = validarLojaNova(dados);
  if (problema) return { ok: false, erro: problema };
  const email = dados.donoEmail.trim().toLowerCase();
  const db = central();
  let chave: Buffer;
  try {
    chave = chaveDoCofre(process.env.CHAVE_DAS_CONEXOES);
  } catch {
    return { ok: false, erro: "CHAVE_DAS_CONEXOES não configurada (ou curta) no projeto master da Vercel." };
  }
  prepararWebSocket();

  // ── 1. Central ───────────────────────────────────────────────────────────
  const existente = await db.empresa.findUnique({
    where: { slug: dados.slug },
    select: { id: true, tenants: { select: { id: true, status: true, connectionRef: true } } },
  });
  let empresaId: string;
  let tenantId: string;
  if (existente) {
    const tenant = existente.tenants[0];
    if (!tenant || tenant.status !== "PROVISIONANDO" || tenant.connectionRef !== REF_DO_COFRE) {
      return { ok: false, erro: "Já existe uma loja com este identificador." };
    }
    empresaId = existente.id;
    tenantId = tenant.id;
  } else {
    if (await db.tenant.findUnique({ where: { slug: dados.slug }, select: { id: true } })) {
      return { ok: false, erro: "Já existe uma loja com este identificador." };
    }
    const criado = await db.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nome: dados.nomeDaLoja.trim(), slug: dados.slug, status: "ATIVA" },
        select: { id: true },
      });
      const tenant = await tx.tenant.create({
        data: { empresaId: empresa.id, slug: dados.slug, status: "PROVISIONANDO", versaoSchema: "provisionando", connectionRef: REF_DO_COFRE },
        select: { id: true },
      });
      await criarCargosPadrao(empresa.id, tx);
      await tx.registroMaster.create({
        data: { administradorId, empresaId: empresa.id, acao: "CRIAR_LOJA_INICIO", detalhes: { slug: dados.slug, nomeDaLoja: dados.nomeDaLoja.trim(), donoNome: dados.donoNome.trim(), donoEmail: email } },
        select: { id: true },
      });
      return { empresaId: empresa.id, tenantId: tenant.id };
    });
    empresaId = criado.empresaId;
    tenantId = criado.tenantId;
  }

  try {
    // ── 2. Banco da loja + cofre ──────────────────────────────────────────
    let conexao: string;
    const guardada = await db.conexaoTenant.findUnique({ where: { tenantId }, select: { conexaoCifrada: true } });
    if (guardada) {
      conexao = abrirConexao(guardada.conexaoCifrada, tenantId, chave);
    } else {
      const nome = nomeNoBanco(dados.slug);
      const banco = await bancoDaLoja(nome);
      conexao = banco.uri;
      await db.conexaoTenant.create({
        data: { tenantId, conexaoCifrada: guardarConexao(conexao, tenantId, chave), neonProjetoId: banco.projetoId, neonBancoNome: nome, neonPapel: nome },
        select: { tenantId: true },
      });
    }

    // ── 3. Migrations ─────────────────────────────────────────────────────
    const pool = new Pool({ connectionString: conexao });
    let ultima: string | null;
    try {
      const resultado = await aplicarMigracoes(
        (sql, parametros) => pool.query(sql, parametros as unknown[] | undefined) as unknown as Promise<{ rows: Array<Record<string, unknown>> }>,
        listarMigracoes(pastaDasMigracoes())
      );
      ultima = resultado.ultima;
    } finally {
      await pool.end();
    }

    // ── 4. Responsavel + dados iniciais ───────────────────────────────────
    const cargoAdministrador = await db.cargo.findFirst({ where: { empresaId, nome: "Administrador" }, select: { id: true } });
    let conta = await db.usuarioCentral.findUnique({
      where: { email },
      select: { id: true, nome: true, senha: true, empresas: { select: { empresaId: true } } },
    });
    let senhaTemporaria: string | null = null;
    const usadaEmOutraLoja = conta?.empresas.some((e) => e.empresaId !== empresaId) ?? false;
    if (!conta || !usadaEmOutraLoja) {
      // Conta nova — ou criada por uma tentativa anterior desta mesma loja,
      // cuja senha ninguem chegou a ver: gera (de novo) e mostra agora.
      senhaTemporaria = gerarSenhaSugerida();
      const hash = await bcrypt.hash(senhaTemporaria, CUSTO_HASH_SENHA);
      conta = await db.usuarioCentral.upsert({
        where: { email },
        create: { nome: dados.donoNome.trim(), email, senha: hash, ativo: true },
        update: { nome: dados.donoNome.trim(), senha: hash, ativo: true },
        select: { id: true, nome: true, senha: true, empresas: { select: { empresaId: true } } },
      });
    }

    const prismaLoja = new PrismaDaLoja({ adapter: new PrismaNeon({ connectionString: conexao }) });
    try {
      if (!(await prismaLoja.configuracao.findFirst({ select: { id: true } }))) {
        await prismaLoja.configuracao.create({ data: { nomeFantasia: dados.nomeDaLoja.trim() }, select: { id: true } });
      }
      await garantirClienteConsumidorFinal(prismaLoja);
      await prismaLoja.usuario.upsert({
        where: { email },
        create: { id: conta.id, nome: conta.nome, email, senha: conta.senha, role: "ADMIN" },
        update: { nome: conta.nome, role: "ADMIN" },
        select: { id: true },
      });
    } finally {
      await prismaLoja.$disconnect();
    }

    // ── 5. Vinculo, dono e loja no ar ─────────────────────────────────────
    await db.$transaction(async (tx) => {
      const vinculo = await tx.usuarioEmpresa.upsert({
        where: { usuarioId_empresaId: { usuarioId: conta.id, empresaId } },
        create: { usuarioId: conta.id, empresaId, role: "ADMIN", cargoId: cargoAdministrador?.id ?? null, ativo: true },
        update: { role: "ADMIN", cargoId: cargoAdministrador?.id ?? null, ativo: true },
        select: { id: true },
      });
      await tx.empresa.update({ where: { id: empresaId }, data: { proprietarioUsuarioEmpresaId: vinculo.id }, select: { id: true } });
      await tx.tenant.update({ where: { id: tenantId }, data: { status: "ATIVO", versaoSchema: ultima ?? "desconhecida" }, select: { id: true } });
      await tx.registroMaster.create({
        data: { administradorId, empresaId, acao: "CRIAR_LOJA", detalhes: { slug: dados.slug, responsavel: email } },
        select: { id: true },
      });
    });

    return { ok: true, empresaId, senhaTemporaria, email };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("[master] criacao da loja parou:", mensagem);
    await db.registroMaster
      .create({ data: { administradorId, empresaId, acao: "CRIAR_LOJA_FALHOU", detalhes: { etapa: mensagem.slice(0, 300) } }, select: { id: true } })
      .catch(() => {});
    return {
      ok: false,
      empresaId,
      erro: `A criação parou no meio: ${mensagem.slice(0, 200)}. Nada se perdeu — abra a loja e toque em "Continuar criação".`,
    };
  }
}
