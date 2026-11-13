"use server";

import { redirect } from "next/navigation";

import { central } from "~/lib/prisma-central";
import { chaveDoLimite, codigoConfere, estaBloqueado, hash, JANELA_DE_TENTATIVAS_MS, validarSenhaNova } from "~/lib/regras";
import { abrirSessao, conferirSenha, encerrarSessao, gerarHashSenha } from "~/lib/sessao";

/**
 * `valores` devolve o que nao e segredo (nome, e-mail): o React limpa o
 * formulario depois de cada envio, e sem isso a pessoa redigitaria tudo a
 * cada erro. Senhas e codigo nunca voltam.
 */
export type EstadoDoFormulario = { erro: string | null; valores?: { nome?: string; email?: string } };

const ERRO_GENERICO = "E-mail ou senha incorretos.";
// Hash de uma senha qualquer: quando o e-mail nao existe, a comparacao roda
// igual, e o tempo de resposta nao revela quais e-mails tem acesso.
const HASH_FALSO = "$2b$12$PfVsMkbAkMkQBpHiqEfmj.Nwjcy07eKCMQ4CACeSFDTesHAaKTn2G";

async function falhasRecentes(chave: string): Promise<Date[]> {
  const linhas = await central().tentativaLoginFalha.findMany({
    where: { emailHash: chave, criadoEm: { gte: new Date(Date.now() - JANELA_DE_TENTATIVAS_MS) } },
    select: { criadoEm: true },
    take: 20,
  });
  return linhas.map((l) => l.criadoEm);
}

async function registrarFalha(chave: string) {
  await central().tentativaLoginFalha.create({ data: { emailHash: chave, ipHash: hash("master") }, select: { id: true } });
}

export async function entrar(_anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const senha = String(dados.get("senha") ?? "");
  const valores = { email };
  if (!email || !senha) return { erro: "Informe e-mail e senha.", valores };

  const chave = chaveDoLimite(email);
  if (estaBloqueado(await falhasRecentes(chave), new Date())) {
    return { erro: "Muitas tentativas erradas. Aguarde 15 minutos.", valores };
  }

  const administrador = await central().administradorMaster.findUnique({
    where: { email },
    select: { id: true, senhaHash: true, ativo: true },
  });
  const confere = await conferirSenha(senha, administrador?.senhaHash ?? HASH_FALSO);
  if (!administrador || !administrador.ativo || !confere) {
    await registrarFalha(chave);
    return { erro: ERRO_GENERICO, valores };
  }

  await central().tentativaLoginFalha.deleteMany({ where: { emailHash: chave } });
  await abrirSessao(administrador.id);
  redirect("/");
}

/**
 * Primeiro acesso: so funciona enquanto nao existe NENHUM administrador, e com
 * o codigo MASTER_CODIGO_DE_CRIACAO que o dono definiu na Vercel. Depois do
 * primeiro, esta porta fecha sozinha.
 */
export async function criarPrimeiroAcesso(_anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> {
  const codigo = String(dados.get("codigo") ?? "");
  const nome = String(dados.get("nome") ?? "").trim();
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const senha = String(dados.get("senha") ?? "");
  const confirmacao = String(dados.get("confirmacao") ?? "");
  const valores = { nome, email };
  const falha = (erro: string): EstadoDoFormulario => ({ erro, valores });

  const chave = chaveDoLimite("criacao");
  if (estaBloqueado(await falhasRecentes(chave), new Date())) {
    return falha("Muitas tentativas erradas. Aguarde 15 minutos.");
  }
  if ((await central().administradorMaster.count()) > 0) {
    return falha("O primeiro acesso já foi criado. Entre com e-mail e senha.");
  }
  if (!codigoConfere(codigo, process.env.MASTER_CODIGO_DE_CRIACAO)) {
    await registrarFalha(chave);
    return falha("Código de criação incorreto (ou ainda não configurado na Vercel).");
  }
  if (nome.length < 2) return falha("Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return falha("E-mail inválido.");
  const problema = validarSenhaNova(senha);
  if (problema) return falha(problema);
  if (senha !== confirmacao) return falha("A confirmação não confere com a senha.");

  const criado = await central().administradorMaster.create({
    data: { nome, email, senhaHash: await gerarHashSenha(senha) },
    select: { id: true },
  });
  await abrirSessao(criado.id);
  redirect("/");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
