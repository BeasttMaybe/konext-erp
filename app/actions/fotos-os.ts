"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { escopoOrdemServico } from "@/lib/auth/escopos";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import {
  MAXIMO_DE_FOTOS_POR_OS,
  chavePertenceAOrdem,
  ehTipoDeImagemAceito,
  montarChaveDaFoto,
  validarFoto,
  type MomentoFoto,
} from "@/lib/dominio/os/fotos";
import {
  apagarObjeto,
  armazenamentoEstaConfigurado,
  gerarUrlDeLeitura,
  gravarObjeto,
  traduzirErroDeArmazenamento,
} from "@/lib/fotos/armazenamento";

export type FotoDaOS = {
  id: string;
  momento: MomentoFoto;
  descricao: string | null;
  tamanhoBytes: number;
  largura: number | null;
  altura: number | null;
  enviadaPeloCelular: boolean;
  enviadaPorNome: string | null;
  criadoEm: string;
  /**
   * URL assinada, com validade curta (ver lib/fotos/armazenamento.ts). Não é
   * link permanente de propósito: foto de aparelho é dado de terceiro, e link
   * público vale para sempre e para qualquer um que o receba.
   */
  url: string;
};

export type ResultadoFoto = { sucesso: true; mensagem: string } | { sucesso: false; erro: string };

/**
 * Confere que a OS existe E que este usuário pode vê-la.
 *
 * O escopo importa: um técnico que só enxerga as próprias OS não pode listar
 * nem subir foto na OS de outro. Sem este filtro, o id na URL seria suficiente
 * para contornar a regra que vale no resto da tela.
 */
async function exigirOrdemVisivel(ordemServicoId: string) {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "os.ver");

  const ordem = await contexto.prisma.ordemServico.findFirst({
    where: { AND: [{ id: ordemServicoId }, escopoOrdemServico(contexto)] },
    select: { id: true, numeroOs: true },
  });

  return { contexto, ordem };
}

export async function listarFotosDaOS(ordemServicoId: string): Promise<FotoDaOS[]> {
  const { contexto, ordem } = await exigirOrdemVisivel(ordemServicoId);

  if (!ordem || !armazenamentoEstaConfigurado()) return [];

  const fotos = await contexto.prisma.fotoOS.findMany({
    where: { ordemServicoId },
    orderBy: [{ momento: "asc" }, { criadoEm: "asc" }],
    select: {
      id: true,
      momento: true,
      descricao: true,
      chaveArmazenamento: true,
      tamanhoBytes: true,
      largura: true,
      altura: true,
      enviadaPeloCelular: true,
      criadoEm: true,
      enviadaPor: { select: { nome: true } },
    },
  });

  // As URLs são assinadas uma a uma, em paralelo. A assinatura é local (não vai
  // à rede), então o custo é desprezível mesmo com as 20 fotos do limite.
  return Promise.all(
    fotos.map(async (foto) => ({
      id: foto.id,
      momento: foto.momento as MomentoFoto,
      descricao: foto.descricao,
      tamanhoBytes: foto.tamanhoBytes,
      largura: foto.largura,
      altura: foto.altura,
      enviadaPeloCelular: foto.enviadaPeloCelular,
      enviadaPorNome: foto.enviadaPor?.nome ?? null,
      criadoEm: foto.criadoEm.toISOString(),
      url: await gerarUrlDeLeitura(foto.chaveArmazenamento),
    }))
  );
}

/**
 * Recebe a foto já REDUZIDA pelo navegador.
 *
 * A redução acontece no cliente, e não aqui, por dois motivos: foto de celular
 * tem 3 a 6 MB e o corpo de uma requisição na Vercel para em 4,5 MB — então o
 * arquivo original simplesmente não chegaria; e reduzir antes de subir
 * economiza o tempo de upload de quem está no balcão com o cliente esperando.
 */
export async function enviarFotoDaOS(dados: FormData): Promise<ResultadoFoto> {
  try {
    const ordemServicoId = String(dados.get("ordemServicoId") ?? "");
    const momento = String(dados.get("momento") ?? "ENTRADA") as MomentoFoto;
    const descricaoBruta = String(dados.get("descricao") ?? "").trim();
    const arquivo = dados.get("arquivo");

    const { contexto, ordem } = await exigirOrdemVisivel(ordemServicoId);
    exigirPermissao(contexto, "os.editar");

    if (!ordem) return { sucesso: false, erro: "Ordem de serviço não encontrada." };

    if (!armazenamentoEstaConfigurado()) {
      return {
        sucesso: false,
        erro: "O armazenamento de fotos ainda não está configurado. Veja em Configurações.",
      };
    }

    if (!(arquivo instanceof File)) {
      return { sucesso: false, erro: "Nenhum arquivo foi recebido." };
    }

    const fotosJaExistentes = await contexto.prisma.fotoOS.count({ where: { ordemServicoId } });

    const validacao = validarFoto({
      tipoConteudo: arquivo.type,
      tamanhoBytes: arquivo.size,
      fotosJaExistentes,
    });

    if (!validacao.valido) return { sucesso: false, erro: validacao.erro };
    if (!ehTipoDeImagemAceito(arquivo.type)) {
      return { sucesso: false, erro: "Esse arquivo não é uma imagem JPG, PNG ou WebP." };
    }

    const chave = montarChaveDaFoto({
      ordemServicoId,
      tipoConteudo: arquivo.type,
      identificador: randomUUID(),
    });

    const conteudo = new Uint8Array(await arquivo.arrayBuffer());

    // O arquivo vai pro bucket ANTES da linha no banco. Se gravar o objeto
    // falhar, nada é escrito e a tela mostra o erro; na ordem inversa, uma
    // falha deixaria linha apontando pra arquivo que não existe — e a galeria
    // mostraria um quadro quebrado que ninguém sabe de onde veio.
    await gravarObjeto({ chave, corpo: conteudo, tipoConteudo: arquivo.type });

    const largura = Number.parseInt(String(dados.get("largura") ?? ""), 10);
    const altura = Number.parseInt(String(dados.get("altura") ?? ""), 10);

    await contexto.prisma.$transaction(async (tx) => {
      const criada = await tx.fotoOS.create({
        data: {
          ordemServicoId,
          chaveArmazenamento: chave,
          momento,
          descricao: descricaoBruta.length > 0 ? descricaoBruta.slice(0, 200) : null,
          tipoConteudo: arquivo.type,
          tamanhoBytes: arquivo.size,
          largura: Number.isFinite(largura) && largura > 0 ? largura : null,
          altura: Number.isFinite(altura) && altura > 0 ? altura : null,
          enviadaPorId: contexto.usuarioOperacional?.id ?? null,
        },
        select: { id: true },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/fotos-os.ts:enviarFotoDaOS"
        ),
        {
          acao: ACOES_AUDITORIA.ADICIONAR_FOTO_OS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: ordemServicoId,
          dadosDepois: { fotoId: criada.id, momento, tamanhoBytes: arquivo.size },
        }
      );
    });

    revalidatePath(`/os/${ordemServicoId}`);

    return { sucesso: true, mensagem: "Foto adicionada." };
  } catch (erro) {
    console.error("Erro ao enviar foto da OS:", erro);
    return { sucesso: false, erro: traduzirErroDeArmazenamento(erro) };
  }
}

/**
 * Apaga a foto: primeiro o arquivo, depois a linha.
 *
 * Nesta ordem porque o contrário deixaria o arquivo no bucket sem nada
 * apontando para ele — lixo que ninguém encontra e que continua custando. Se o
 * arquivo já não existir, seguir em frente é o certo: o objetivo é que a foto
 * suma, e ela sumiu.
 */
export async function apagarFotoDaOS(fotoId: string): Promise<ResultadoFoto> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "os.editar");

    const foto = await contexto.prisma.fotoOS.findUnique({
      where: { id: fotoId },
      select: { id: true, chaveArmazenamento: true, ordemServicoId: true, momento: true },
    });

    if (!foto) return { sucesso: false, erro: "Foto não encontrada." };

    // A OS precisa estar no escopo de quem está apagando — o id da foto sozinho
    // não é autorização.
    const { ordem } = await exigirOrdemVisivel(foto.ordemServicoId);
    if (!ordem) return { sucesso: false, erro: "Ordem de serviço não encontrada." };

    // A chave vem da linha, mas é conferida contra a OS: linha adulterada não
    // pode fazer o sistema apagar arquivo de outro lugar do bucket.
    if (!chavePertenceAOrdem(foto.chaveArmazenamento, foto.ordemServicoId)) {
      return { sucesso: false, erro: "Esta foto não pertence a esta ordem de serviço." };
    }

    await apagarObjeto(foto.chaveArmazenamento).catch((erro) => {
      // Objeto já ausente não impede remover a linha: o fim é a foto sumir.
      if (!/NoSuchKey|NotFound|404/i.test(String(erro))) throw erro;
    });

    await contexto.prisma.$transaction(async (tx) => {
      await tx.fotoOS.delete({ where: { id: foto.id } });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/fotos-os.ts:apagarFotoDaOS"
        ),
        {
          acao: ACOES_AUDITORIA.REMOVER_FOTO_OS,
          entidade: ENTIDADES_AUDITORIA.ORDEM_SERVICO,
          entidadeId: foto.ordemServicoId,
          dadosAntes: { fotoId: foto.id, momento: foto.momento },
        }
      );
    });

    revalidatePath(`/os/${foto.ordemServicoId}`);

    return { sucesso: true, mensagem: "Foto removida." };
  } catch (erro) {
    console.error("Erro ao apagar foto da OS:", erro);
    return { sucesso: false, erro: traduzirErroDeArmazenamento(erro) };
  }
}

export type SituacaoFotosDaOS = {
  armazenamentoConfigurado: boolean;
  totalDeFotos: number;
  limite: number;
};

export async function obterSituacaoFotosDaOS(
  ordemServicoId: string
): Promise<SituacaoFotosDaOS> {
  const { contexto, ordem } = await exigirOrdemVisivel(ordemServicoId);

  return {
    armazenamentoConfigurado: armazenamentoEstaConfigurado(),
    totalDeFotos: ordem ? await contexto.prisma.fotoOS.count({ where: { ordemServicoId } }) : 0,
    limite: MAXIMO_DE_FOTOS_POR_OS,
  };
}
