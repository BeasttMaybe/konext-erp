"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { abrirTenantPorSlug } from "@/lib/tenant/tenant-publico-por-slug";
import { hashDoSegredo } from "@/lib/fotos/token-de-envio";
import { gravarObjeto, traduzirErroDeArmazenamento, armazenamentoEstaConfigurado } from "@/lib/fotos/armazenamento";
import {
  conteudoConfereComOTipo,
  ehTipoDeImagemAceito,
  ERRO_DE_CONTEUDO_QUE_NAO_E_IMAGEM,
  MAXIMO_DE_FOTOS_POR_OS,
  montarChaveDaFoto,
  validarFoto,
  type MomentoFoto,
} from "@/lib/dominio/os/fotos";
import { FRASE_DE_RECUSA, lerLinkDaUrl } from "@/lib/dominio/os/link-de-foto";

/**
 * O lado PÚBLICO do envio de foto pelo celular.
 *
 * Tudo aqui roda sem sessão, sem cookie e sem usuário. Quem chega tem só um
 * endereço, e qualquer pessoa da internet pode chamar estas funções com o
 * que quiser dentro. As regras que isso impõe, e que valem para cada função
 * deste arquivo:
 *
 * 1. **Nada de `exigirContextoTenant`.** Não existe sessão pra ler. O banco
 *    é aberto pelo slug e a autorização vem do segredo, conferido a cada
 *    chamada — nunca "a página já tinha validado".
 * 2. **O token é conferido de novo em todo envio.** A tela que abriu há vinte
 *    minutos não prova nada sobre agora: o link pode ter sido revogado no
 *    meio, e revogar precisa ter efeito imediato pra significar alguma coisa.
 * 3. **Uma frase só pra toda recusa.** "Não existe", "expirou" e "revogado"
 *    saem iguais na tela. Distinguir contaria a quem está sondando se o
 *    formato do segredo estava certo.
 * 4. **Nada de dado de cliente sai daqui.** O link pode ser encaminhado sem
 *    querer; a tela mostra o número da OS e o aparelho, que é o necessário
 *    pra conferir que é o certo, e mais nada.
 */

export type OrdemParaEnvio = {
  ordemServicoId: string;
  numeroOs: number;
  aparelho: string;
  lojaNome: string;
  fotosEnviadas: number;
  limiteDeFotos: number;
};

export type AberturaDoLink =
  | { ok: true; ordem: OrdemParaEnvio }
  | { ok: false; erro: string };

/**
 * Resolve o link: loja, token e OS.
 *
 * Usada pela página e por cada envio. É de propósito que ela devolva o
 * cliente do Prisma junto — quem chama precisa continuar no MESMO banco que
 * foi resolvido aqui, e buscar de novo abriria espaço pra usar o slug de uma
 * loja com o id de OS de outra.
 */
async function resolverLink(slugBruto: unknown, segredoBruto: unknown) {
  const link = lerLinkDaUrl(slugBruto, segredoBruto);
  if (!link) return null;

  const tenant = await abrirTenantPorSlug(link.slug);
  if (!tenant) return null;

  const token = await tenant.prisma.tokenFotoOS.findUnique({
    where: { tokenHash: hashDoSegredo(link.segredo) },
    select: {
      id: true,
      expiraEm: true,
      revogadoEm: true,
      ordemServico: {
        select: {
          id: true,
          numeroOs: true,
          marca: true,
          modelo: true,
          equipamento: true,
        },
      },
    },
  });

  if (!token) return null;
  if (token.revogadoEm !== null) return null;
  if (token.expiraEm.getTime() <= Date.now()) return null;

  return { tenant, token };
}

function descreverAparelho(ordem: {
  marca: string | null;
  modelo: string | null;
  equipamento: string;
}): string {
  const partes = [ordem.marca, ordem.modelo].filter(
    (parte): parte is string => typeof parte === "string" && parte.trim() !== ""
  );

  return partes.length > 0 ? partes.join(" ") : ordem.equipamento;
}

/** Abre o link: diz se vale e o que a tela pode mostrar. */
export async function abrirLinkDeFoto(slug: string, segredo: string): Promise<AberturaDoLink> {
  try {
    const resolvido = await resolverLink(slug, segredo);
    if (!resolvido) return { ok: false, erro: FRASE_DE_RECUSA };

    if (!armazenamentoEstaConfigurado()) {
      return {
        ok: false,
        erro: "O envio de fotos não está configurado nesta loja. Avise o responsável.",
      };
    }

    const { tenant, token } = resolvido;

    const fotosEnviadas = await tenant.prisma.fotoOS.count({
      where: { ordemServicoId: token.ordemServico.id },
    });

    // Marca que o link foi aberto. Melhor esforço: se falhar, o envio não
    // pode parar por causa de um carimbo informativo.
    await tenant.prisma.tokenFotoOS
      .update({ where: { id: token.id }, data: { ultimoUsoEm: new Date() } })
      .catch(() => undefined);

    return {
      ok: true,
      ordem: {
        ordemServicoId: token.ordemServico.id,
        numeroOs: token.ordemServico.numeroOs,
        aparelho: descreverAparelho(token.ordemServico),
        lojaNome: tenant.empresaNome,
        fotosEnviadas,
        limiteDeFotos: MAXIMO_DE_FOTOS_POR_OS,
      },
    };
  } catch (erro) {
    console.error("Erro ao abrir link de foto:", erro);
    return { ok: false, erro: FRASE_DE_RECUSA };
  }
}

export type ResultadoEnvioPublico =
  | { sucesso: true; fotosEnviadas: number }
  | { sucesso: false; erro: string };

/**
 * Recebe uma foto pelo link.
 *
 * O `ordemServicoId` NÃO vem do formulário: ele sai do token, aqui dentro.
 * Aceitá-lo de fora transformaria o link de uma OS numa permissão de escrita
 * em qualquer OS da loja — é o tipo de parâmetro que parece inofensivo porque
 * a tela "já sabe" o valor certo.
 */
export async function enviarFotoPeloCelular(dados: FormData): Promise<ResultadoEnvioPublico> {
  try {
    const resolvido = await resolverLink(dados.get("slug"), dados.get("segredo"));
    if (!resolvido) return { sucesso: false, erro: FRASE_DE_RECUSA };

    const { tenant, token } = resolvido;
    const ordemServicoId = token.ordemServico.id;

    if (!armazenamentoEstaConfigurado()) {
      return { sucesso: false, erro: "O envio de fotos não está configurado nesta loja." };
    }

    const arquivo = dados.get("arquivo");
    if (!(arquivo instanceof File)) {
      return { sucesso: false, erro: "Nenhuma foto foi recebida." };
    }

    const momentoBruto = String(dados.get("momento") ?? "ENTRADA");
    const momento: MomentoFoto =
      momentoBruto === "DURANTE" || momentoBruto === "SAIDA" ? momentoBruto : "ENTRADA";

    const fotosJaExistentes = await tenant.prisma.fotoOS.count({ where: { ordemServicoId } });

    // As MESMAS regras do envio pela tela de dentro: tipo, tamanho e limite
    // por OS. O caminho público não pode ser o caminho frouxo — seria o
    // primeiro lugar que alguém usaria pra encher o bucket.
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

    // O tipo declarado ja passou em `validarFoto`, mas ele e escrito por quem
    // envia. Aqui conferem-se os BYTES, antes de qualquer coisa ir ao bucket.
    if (!conteudoConfereComOTipo(conteudo, arquivo.type)) {
      return { sucesso: false, erro: ERRO_DE_CONTEUDO_QUE_NAO_E_IMAGEM };
    }

    // Objeto antes da linha, igual ao envio de dentro: falha ao gravar o
    // arquivo não pode deixar linha apontando pro que não existe.
    await gravarObjeto({ chave, corpo: conteudo, tipoConteudo: arquivo.type });

    const largura = Number.parseInt(String(dados.get("largura") ?? ""), 10);
    const altura = Number.parseInt(String(dados.get("altura") ?? ""), 10);

    await tenant.prisma.fotoOS.create({
      data: {
        ordemServicoId,
        chaveArmazenamento: chave,
        momento,
        tipoConteudo: arquivo.type,
        tamanhoBytes: arquivo.size,
        largura: Number.isFinite(largura) && largura > 0 ? largura : null,
        altura: Number.isFinite(altura) && altura > 0 ? altura : null,
        // Sem sessão não há quem: `enviadaPorId` fica nulo e
        // `enviadaPeloCelular` conta a história. Inventar um autor aqui seria
        // pior do que admitir que veio pelo link.
        enviadaPorId: null,
        enviadaPeloCelular: true,
      },
    });

    await tenant.prisma.tokenFotoOS
      .update({ where: { id: token.id }, data: { ultimoUsoEm: new Date() } })
      .catch(() => undefined);

    revalidatePath(`/os/${ordemServicoId}`);

    return { sucesso: true, fotosEnviadas: fotosJaExistentes + 1 };
  } catch (erro) {
    console.error("Erro no envio de foto pelo celular:", erro);
    return { sucesso: false, erro: traduzirErroDeArmazenamento(erro) };
  }
}
