import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

import { exigirPermissao } from "@/lib/auth/permissoes";
import { dataDeCalendario } from "@/lib/datas";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * GET /api/financeiro/notas-fiscais/xml?inicio=&fim=
 *
 * Baixa num ZIP os XML das notas emitidas no período — o pacote que o
 * contador pede todo mês.
 *
 * É rota, e não server action, porque o resultado é um ARQUIVO: o navegador
 * baixa direto do link, sem passar por base64 na resposta de uma action nem
 * por memória do cliente.
 *
 * Os XML não são guardados aqui: a Konext só tem o endereço deles no Bling.
 * Isso é deliberado — o XML autêntico é o que está lá, e manter uma cópia
 * seria manter uma segunda versão da verdade fiscal, que um dia divergiria.
 * O preço é que montar o pacote exige buscar os arquivos na hora.
 */

/** Teto por pacote. Um mês de loja não chega perto; um ano inteiro chegaria. */
const TETO_DE_NOTAS = 300;

/** Quantos downloads simultâneos. Baixo de propósito: é o servidor do Bling. */
const SIMULTANEOS = 4;

function nomeDoArquivo(numero: string, serie: string | null, chave: string | null): string {
  // A chave identifica a nota sem ambiguidade e é o que o contador procura.
  // Número e série vêm na frente porque é assim que uma pasta fica legível.
  const partes = [serie ? `s${serie}` : null, `nf${numero}`, chave].filter(Boolean);
  return `${partes.join("-")}.xml`.replace(/[^\w.-]/g, "_");
}

function ehEnderecoHttps(endereco: string): boolean {
  try {
    return new URL(endereco).protocol === "https:";
  } catch {
    return false;
  }
}

async function baixarEmLotes(
  notas: Array<{ nome: string; url: string }>,
  zip: JSZip
): Promise<{ baixados: number; falhas: string[] }> {
  const falhas: string[] = [];
  let baixados = 0;

  for (let inicio = 0; inicio < notas.length; inicio += SIMULTANEOS) {
    const lote = notas.slice(inicio, inicio + SIMULTANEOS);

    await Promise.all(
      lote.map(async (nota) => {
        try {
          // O endereco vem do banco, gravado pela sincronizacao com o Bling.
          // So se busca por https: um valor adulterado nao pode fazer o
          // servidor requisitar `http://` de rede interna nem `file:`.
          if (!ehEnderecoHttps(nota.url)) {
            falhas.push(`${nota.nome}: o endereço do XML não é https`);
            return;
          }

          const resposta = await fetch(nota.url);

          if (!resposta.ok) {
            falhas.push(`${nota.nome}: o Bling respondeu ${resposta.status}`);
            return;
          }

          const texto = await resposta.text();

          // O Bling devolve HTML (uma página de erro ou de login) quando o
          // link expirou. Guardar isso com extensão .xml entregaria ao
          // contador um pacote que parece certo e não abre.
          if (!texto.trimStart().startsWith("<?xml") && !texto.includes("<nfeProc")) {
            falhas.push(`${nota.nome}: o Bling não devolveu XML (link expirado?)`);
            return;
          }

          zip.file(nota.nome, texto);
          baixados += 1;
        } catch (erro) {
          falhas.push(`${nota.nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
        }
      })
    );
  }

  return { baixados, falhas };
}

export async function GET(request: NextRequest) {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "financeiro.ver");

  const parametros = request.nextUrl.searchParams;
  const inicio = dataDeCalendario(parametros.get("inicio") ?? "");
  const fim = dataDeCalendario(parametros.get("fim") ?? "");

  if (!inicio || !fim) {
    return NextResponse.json(
      { erro: "Informe o período (inicio e fim) no formato aaaa-mm-dd." },
      { status: 400 }
    );
  }

  const notas = await contexto.prisma.notaFiscal.findMany({
    where: {
      linkXml: { not: null },
      dataEmissao: { gte: inicio, lte: fim },
      // Nota cancelada continua existindo e o contador costuma querer o XML
      // dela também — cancelamento é um fato fiscal, não um apagamento.
    },
    select: { numero: true, serie: true, chaveAcesso: true, linkXml: true },
    orderBy: { dataEmissao: "asc" },
    take: TETO_DE_NOTAS,
  });

  if (notas.length === 0) {
    return NextResponse.json(
      { erro: "Nenhuma nota com XML no período escolhido." },
      { status: 404 }
    );
  }

  const zip = new JSZip();

  const { baixados, falhas } = await baixarEmLotes(
    notas
      .filter((nota): nota is typeof nota & { linkXml: string } => nota.linkXml !== null)
      .map((nota) => ({
        nome: nomeDoArquivo(nota.numero, nota.serie, nota.chaveAcesso),
        url: nota.linkXml,
      })),
    zip
  );

  // As falhas vão DENTRO do pacote, num arquivo de texto. Entregar um ZIP com
  // menos notas do que o esperado e nenhuma explicação é o jeito mais certo
  // de o contador descobrir o buraco tarde demais.
  if (falhas.length > 0) {
    zip.file(
      "NOTAS-QUE-FALTARAM.txt",
      [
        `${falhas.length} de ${notas.length} notas não puderam ser baixadas do Bling:`,
        "",
        ...falhas,
        "",
        "Baixe essas manualmente pelo Bling ou tente de novo mais tarde.",
      ].join("\n")
    );
  }

  const pacote = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const nomeDoPacote = `notas-fiscais-${parametros.get("inicio")}-a-${parametros.get("fim")}.zip`;

  return new NextResponse(new Uint8Array(pacote), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeDoPacote}"`,
      // Para a tela poder dizer quantas vieram sem abrir o pacote.
      "X-Notas-Baixadas": String(baixados),
      "X-Notas-Com-Falha": String(falhas.length),
    },
  });
}
