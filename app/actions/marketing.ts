"use server";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import {
  CANAIS_ORGANICOS,
  PLATAFORMAS,
  plataformaConfiguravel,
  type CanalMarketing,
  type IdPlataformaMarketing,
} from "@/lib/dominio/marketing/plataformas";
import {
  podeCancelar,
  podeEditar,
  statusAoSalvar,
  validarPublicacao,
  type StatusPublicacao,
  type TipoPublicacao,
} from "@/lib/dominio/marketing/publicacao";
import type { ContextoTenantServidor } from "@/types/tenant";

/**
 * Marketing (lib/dominio/marketing). Publicações e conexões ficam no banco do
 * tenant; os tokens das plataformas são cifrados com a chave da empresa. O que
 * realmente fala com Meta/Google/TikTok entra depois, conexão por conexão —
 * aqui está a base: compor, agendar e guardar.
 */

const ORIGEM = "app/actions/marketing.ts";

// ── Conexões ─────────────────────────────────────────────────────────────────

export type SituacaoDaPlataforma = {
  id: IdPlataformaMarketing;
  nome: string;
  organico: boolean;
  anuncios: boolean;
  preRequisito: string;
  /** O dono já configurou o app (variáveis de ambiente presentes)? */
  pronta: boolean;
  status: StatusConexao;
  contaNome: string | null;
  ultimoErro: string | null;
};

type StatusConexao = "NAO_CONFIGURADA" | "DESCONECTADA" | "CONECTADA" | "EXPIRADA" | "ERRO";

function variaveisPresentes(): Set<string> {
  const presentes = new Set<string>();
  for (const plataforma of PLATAFORMAS) {
    for (const v of plataforma.variaveis) {
      if ((process.env[v] ?? "").trim().length > 0) presentes.add(v);
    }
  }
  return presentes;
}

export async function obterConexoes(): Promise<SituacaoDaPlataforma[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const linhas = await contexto.prisma.conexaoMarketing.findMany({
    select: { plataforma: true, status: true, contaNome: true, ultimoErro: true },
  });
  const porPlataforma = new Map(linhas.map((l) => [l.plataforma, l]));
  const env = variaveisPresentes();

  return PLATAFORMAS.map((def) => {
    const linha = porPlataforma.get(def.id);
    const pronta = plataformaConfiguravel(def.id, env);
    // Sem o app configurado pelo dono, a plataforma nem pode ser conectada.
    const status: StatusConexao = linha ? (linha.status as StatusConexao) : pronta ? "DESCONECTADA" : "NAO_CONFIGURADA";
    return {
      id: def.id,
      nome: def.nome,
      organico: def.organico,
      anuncios: def.anuncios,
      preRequisito: def.preRequisito,
      pronta,
      status: pronta ? status : "NAO_CONFIGURADA",
      contaNome: linha?.contaNome ?? null,
      ultimoErro: linha?.ultimoErro ?? null,
    };
  });
}

export type ResultadoConexao = { ok: true; mensagem: string } | { ok: false; erro: string };

/**
 * Início da conexão de uma plataforma. A troca de tokens (OAuth) de cada
 * plataforma entra numa etapa própria; por ora, se o app ainda não foi
 * configurado pelo dono, explica o que falta.
 */
export async function iniciarConexao(plataforma: string): Promise<ResultadoConexao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.conectar");
  const def = PLATAFORMAS.find((p) => p.id === plataforma);
  if (!def) return { ok: false, erro: "Plataforma inválida." };
  if (!plataformaConfiguravel(def.id, variaveisPresentes())) {
    return {
      ok: false,
      erro: `Antes de conectar, é preciso configurar o app desta plataforma. ${def.preRequisito}`,
    };
  }
  return {
    ok: true,
    mensagem: "Conexão pronta para ligar. O login seguro com a plataforma será o próximo passo desta integração.",
  };
}

// ── Publicações ──────────────────────────────────────────────────────────────

export type MidiaDaPublicacao = { id: string; url: string; tipoConteudo: string };

export type PublicacaoDaLista = {
  id: string;
  tipo: TipoPublicacao;
  texto: string;
  status: StatusPublicacao;
  canais: CanalMarketing[];
  agendadoPara: string | null;
  publicadoEm: string | null;
  orcamentoCentavos: number | null;
  criadoEm: string;
  temMidia: boolean;
};

export async function listarPublicacoes(tipo?: TipoPublicacao): Promise<PublicacaoDaLista[]> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const linhas = await contexto.prisma.publicacaoMarketing.findMany({
    where: tipo ? { tipo } : undefined,
    select: {
      id: true,
      tipo: true,
      texto: true,
      status: true,
      agendadoPara: true,
      publicadoEm: true,
      orcamentoCentavos: true,
      criadoEm: true,
      destinos: { select: { canal: true } },
      _count: { select: { midias: true } },
    },
    orderBy: [{ agendadoPara: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
    take: 200,
  });

  return linhas.map((p) => ({
    id: p.id,
    tipo: p.tipo as TipoPublicacao,
    texto: p.texto,
    status: p.status as StatusPublicacao,
    canais: p.destinos.map((d) => d.canal as CanalMarketing),
    agendadoPara: p.agendadoPara?.toISOString() ?? null,
    publicadoEm: p.publicadoEm?.toISOString() ?? null,
    orcamentoCentavos: p.orcamentoCentavos,
    criadoEm: p.criadoEm.toISOString(),
    temMidia: p._count.midias > 0,
  }));
}

export type ResultadoPublicacao = { ok: true; id: string } | { ok: false; erro: string };

function exigirPermissaoDoTipo(contexto: ContextoTenantServidor, tipo: TipoPublicacao) {
  exigirPermissao(contexto, tipo === "ANUNCIO_PAGO" ? "marketing.anunciar" : "marketing.publicar");
}

export async function salvarPublicacao(id: string | null, entrada: Record<string, unknown>): Promise<ResultadoPublicacao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");

  const validacao = validarPublicacao(entrada ?? {});
  if (!validacao.ok) return { ok: false, erro: validacao.erro };
  const dados = validacao.dados;
  exigirPermissaoDoTipo(contexto, dados.tipo);

  // Posts orgânicos não podem ter canal que seja só de anúncio (ex.: nenhum
  // canal do Google Ads é de publicação). Mantém a escolha coerente.
  const canaisValidos = dados.canais.filter((c) => (CANAIS_ORGANICOS as readonly string[]).includes(c));
  if (canaisValidos.length === 0) return { ok: false, erro: "Escolha um canal de publicação válido." };

  const status = statusAoSalvar(dados);

  try {
    if (id) {
      const atual = await contexto.prisma.publicacaoMarketing.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!atual) return { ok: false, erro: "Publicação não encontrada." };
      if (!podeEditar(atual.status as StatusPublicacao)) return { ok: false, erro: "Esta publicação não pode mais ser editada." };
      await contexto.prisma.$transaction(async (tx) => {
        await tx.publicacaoDestino.deleteMany({ where: { publicacaoId: id } });
        await tx.publicacaoMarketing.update({
          where: { id },
          data: {
            tipo: dados.tipo,
            texto: dados.texto,
            status,
            agendadoPara: dados.agendadoPara ? new Date(dados.agendadoPara) : null,
            orcamentoCentavos: dados.orcamentoCentavos,
            linkDestino: dados.linkDestino,
            ultimoErro: null,
            destinos: { create: canaisValidos.map((canal) => ({ canal })) },
          },
          select: { id: true },
        });
      });
      revalidatePath("/marketing/publicacoes");
      revalidatePath("/marketing/anuncios");
      return { ok: true, id };
    }

    const criada = await contexto.prisma.publicacaoMarketing.create({
      data: {
        tipo: dados.tipo,
        texto: dados.texto,
        status,
        agendadoPara: dados.agendadoPara ? new Date(dados.agendadoPara) : null,
        orcamentoCentavos: dados.orcamentoCentavos,
        linkDestino: dados.linkDestino,
        criadoPorId: contexto.usuarioOperacional.id || null,
        destinos: { create: canaisValidos.map((canal) => ({ canal })) },
      },
      select: { id: true },
    });
    await registrarLogAuditoria(contexto.prisma, contextoAuditoriaDoUsuario(contexto.usuarioOperacional, `${ORIGEM}:salvarPublicacao`), {
      acao: ACOES_AUDITORIA.CRIAR,
      entidade: ENTIDADES_AUDITORIA.PUBLICACAO_MARKETING,
      entidadeId: criada.id,
      dadosDepois: { tipo: dados.tipo, status, canais: canaisValidos },
    });
    revalidatePath("/marketing/publicacoes");
    revalidatePath("/marketing/anuncios");
    return { ok: true, id: criada.id };
  } catch (erro) {
    console.error("[marketing] falha ao salvar publicação", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }
}

export type PublicacaoParaEditar = {
  id: string;
  tipo: TipoPublicacao;
  texto: string;
  status: StatusPublicacao;
  canais: CanalMarketing[];
  agendadoPara: string | null;
  orcamentoCentavos: number | null;
  linkDestino: string | null;
  midias: MidiaDaPublicacao[];
};

export async function obterPublicacao(id: string): Promise<PublicacaoParaEditar | null> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const { gerarUrlDeLeitura } = await import("@/lib/fotos/armazenamento");

  const p = await contexto.prisma.publicacaoMarketing.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      texto: true,
      status: true,
      agendadoPara: true,
      orcamentoCentavos: true,
      linkDestino: true,
      destinos: { select: { canal: true } },
      midias: { select: { id: true, chaveArmazenamento: true, tipoConteudo: true }, orderBy: { ordem: "asc" } },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    tipo: p.tipo as TipoPublicacao,
    texto: p.texto,
    status: p.status as StatusPublicacao,
    canais: p.destinos.map((d) => d.canal as CanalMarketing),
    agendadoPara: p.agendadoPara?.toISOString() ?? null,
    orcamentoCentavos: p.orcamentoCentavos,
    linkDestino: p.linkDestino,
    midias: await Promise.all(
      p.midias.map(async (m) => ({ id: m.id, tipoConteudo: m.tipoConteudo, url: await gerarUrlDeLeitura(m.chaveArmazenamento) }))
    ),
  };
}

export async function cancelarPublicacao(id: string): Promise<ResultadoPublicacao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const atual = await contexto.prisma.publicacaoMarketing.findUnique({ where: { id }, select: { id: true, status: true, tipo: true } });
  if (!atual) return { ok: false, erro: "Publicação não encontrada." };
  exigirPermissaoDoTipo(contexto, atual.tipo as TipoPublicacao);
  if (!podeCancelar(atual.status as StatusPublicacao)) return { ok: false, erro: "Esta publicação não pode ser cancelada." };
  await contexto.prisma.publicacaoMarketing.update({ where: { id }, data: { status: "CANCELADA" }, select: { id: true } });
  revalidatePath("/marketing/publicacoes");
  revalidatePath("/marketing/anuncios");
  return { ok: true, id };
}

export async function excluirPublicacao(id: string): Promise<ResultadoPublicacao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const { apagarObjeto } = await import("@/lib/fotos/armazenamento");
  const p = await contexto.prisma.publicacaoMarketing.findUnique({
    where: { id },
    select: { id: true, tipo: true, midias: { select: { chaveArmazenamento: true } } },
  });
  if (!p) return { ok: false, erro: "Publicação não encontrada." };
  exigirPermissaoDoTipo(contexto, p.tipo as TipoPublicacao);
  for (const m of p.midias) await apagarObjeto(m.chaveArmazenamento).catch(() => {});
  await contexto.prisma.publicacaoMarketing.delete({ where: { id } });
  revalidatePath("/marketing/publicacoes");
  revalidatePath("/marketing/anuncios");
  return { ok: true, id };
}

// ── Mídia ────────────────────────────────────────────────────────────────────

export type ResultadoMidia = { ok: true; midia: MidiaDaPublicacao } | { ok: false; erro: string };

/** Sobe uma imagem e anexa a uma publicação já criada (R2, como as fotos de OS). */
export async function enviarMidiaDaPublicacao(dados: FormData): Promise<ResultadoMidia> {
  const contexto = await exigirContextoTenant();
  const { randomUUID } = await import("node:crypto");
  const { ehTipoDeImagemAceito, TAMANHO_MAXIMO_DA_FOTO_EM_BYTES, conteudoConfereComOTipo } = await import("@/lib/dominio/os/fotos");
  const { armazenamentoEstaConfigurado, gravarObjeto, gerarUrlDeLeitura } = await import("@/lib/fotos/armazenamento");

  const publicacaoId = String(dados.get("publicacaoId") ?? "");
  const arquivo = dados.get("arquivo");

  const pub = await contexto.prisma.publicacaoMarketing.findUnique({ where: { id: publicacaoId }, select: { id: true, tipo: true, status: true } });
  if (!pub) return { ok: false, erro: "Publicação não encontrada." };
  exigirPermissaoDoTipo(contexto, pub.tipo as TipoPublicacao);
  if (!podeEditar(pub.status as StatusPublicacao)) return { ok: false, erro: "Esta publicação não pode mais receber imagens." };
  if (!armazenamentoEstaConfigurado()) return { ok: false, erro: "O armazenamento de imagens ainda não está configurado (Configurações)." };
  if (!(arquivo instanceof File)) return { ok: false, erro: "Nenhum arquivo foi recebido." };
  if (!ehTipoDeImagemAceito(arquivo.type)) return { ok: false, erro: "Envie uma imagem JPG, PNG ou WebP." };
  if (arquivo.size > TAMANHO_MAXIMO_DA_FOTO_EM_BYTES) return { ok: false, erro: "A imagem é grande demais." };

  const total = await contexto.prisma.publicacaoMidia.count({ where: { publicacaoId } });
  if (total >= 10) return { ok: false, erro: "Máximo de 10 imagens por publicação." };

  const extensao = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const chave = `marketing/${publicacaoId}/${randomUUID()}.${extensao}`;
  const conteudo = new Uint8Array(await arquivo.arrayBuffer());
  if (!conteudoConfereComOTipo(conteudo, arquivo.type)) return { ok: false, erro: "Esse arquivo não é uma imagem válida." };

  await gravarObjeto({ chave, corpo: conteudo, tipoConteudo: arquivo.type });
  const midia = await contexto.prisma.publicacaoMidia.create({
    data: { publicacaoId, chaveArmazenamento: chave, tipoConteudo: arquivo.type, tamanhoBytes: arquivo.size, ordem: total },
    select: { id: true, chaveArmazenamento: true, tipoConteudo: true },
  });
  revalidatePath("/marketing/publicacoes");
  return { ok: true, midia: { id: midia.id, tipoConteudo: midia.tipoConteudo, url: await gerarUrlDeLeitura(midia.chaveArmazenamento) } };
}

export async function removerMidiaDaPublicacao(midiaId: string): Promise<{ ok: boolean }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const { apagarObjeto } = await import("@/lib/fotos/armazenamento");
  const midia = await contexto.prisma.publicacaoMidia.findUnique({
    where: { id: midiaId },
    select: { id: true, chaveArmazenamento: true, publicacao: { select: { tipo: true, status: true } } },
  });
  if (!midia) return { ok: false };
  exigirPermissaoDoTipo(contexto, midia.publicacao.tipo as TipoPublicacao);
  if (!podeEditar(midia.publicacao.status as StatusPublicacao)) return { ok: false };
  await apagarObjeto(midia.chaveArmazenamento).catch(() => {});
  await contexto.prisma.publicacaoMidia.delete({ where: { id: midiaId } });
  revalidatePath("/marketing/publicacoes");
  return { ok: true };
}

/** Indicadores da home do Marketing. */
export async function obterResumoMarketing(): Promise<{ agendadas: number; rascunhos: number; publicadas: number; conexoesAtivas: number }> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.ver");
  const [agendadas, rascunhos, publicadas, conexoesAtivas] = await Promise.all([
    contexto.prisma.publicacaoMarketing.count({ where: { status: "AGENDADA" } }),
    contexto.prisma.publicacaoMarketing.count({ where: { status: "RASCUNHO" } }),
    contexto.prisma.publicacaoMarketing.count({ where: { status: "PUBLICADA" } }),
    contexto.prisma.conexaoMarketing.count({ where: { status: "CONECTADA" } }),
  ]);
  return { agendadas, rascunhos, publicadas, conexoesAtivas };
}


// ── Gerador de texto com IA ──────────────────────────────────────────────────

export type ResultadoGeracao =
  | { ok: true; variacoes: string[] }
  | { ok: false; erro: string; configurar?: boolean };

/**
 * Escreve sugestões de legenda com IA, a partir do tema, do tom e das
 * referências do usuário, no contexto da loja (lib/dominio/marketing/
 * gerador-de-texto.ts). A chave de IA é do dono (IA_API_KEY); sem ela, devolve
 * `configurar: true` para a tela explicar.
 */
export async function gerarTextoPublicacao(entrada: Record<string, unknown>): Promise<ResultadoGeracao> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "marketing.publicar");

  const { lerPedido, montarMensagens, separarVariacoes } = await import("@/lib/dominio/marketing/gerador-de-texto");
  const { iaConfigurada, gerarComIA, ErroIA } = await import("@/lib/ia/cliente");

  if (!iaConfigurada()) {
    return {
      ok: false,
      configurar: true,
      erro: "O gerador por IA ainda não está ligado. Configure a chave de IA (IA_API_KEY) para usar.",
    };
  }

  const pedidoLido = lerPedido(entrada ?? {});
  if (!pedidoLido.ok) return { ok: false, erro: pedidoLido.erro };

  const config = await contexto.prisma.configuracao.findFirst({
    select: { nomeFantasia: true, cidade: true, telefone: true },
  });

  const mensagens = montarMensagens(
    {
      nome: config?.nomeFantasia?.trim() || "a loja",
      cidade: config?.cidade?.trim() || null,
      telefone: config?.telefone?.trim() || null,
      segmento: "Assistência técnica de celulares: conserto, troca de tela, bateria, venda de acessórios e películas.",
    },
    pedidoLido.pedido
  );

  try {
    const resposta = await gerarComIA(mensagens);
    const variacoes = separarVariacoes(resposta);
    if (variacoes.length === 0) return { ok: false, erro: "A IA não devolveu texto. Tente de novo." };
    return { ok: true, variacoes };
  } catch (erro) {
    if (erro instanceof ErroIA) return { ok: false, erro: erro.message };
    console.error("[marketing] falha ao gerar texto", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível gerar o texto agora. Tente de novo." };
  }
}
