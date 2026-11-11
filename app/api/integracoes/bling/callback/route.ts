import { NextRequest, NextResponse } from "next/server";

import { trocarCodigoPorTokens } from "@/lib/bling/api";
import { CSP_DA_PAGINA_DE_RESPOSTA, montarHtmlDeResposta } from "@/lib/bling/pagina-de-resposta";
import { salvarConexaoNova } from "@/lib/bling/conexao";
import { estadoExpirou, lerEstado } from "@/lib/bling/estado-oauth";
import { abrirTenantPorSlug } from "@/lib/tenant/tenant-publico-por-slug";
import { urlBaseDaRequisicao } from "@/lib/url-da-requisicao";

/**
 * GET /api/integracoes/bling/callback
 *
 * Onde o Bling devolve o navegador depois da autorização.
 *
 * ESTA ROTA NÃO TEM SESSÃO. Quem chega aqui é o navegador vindo de outro
 * domínio, e é por isso que ela não pode confiar em nada do que vem na URL
 * sem conferir. São três conferências, nesta ordem:
 *
 * 1. **A assinatura do `state`** diz qual loja, e prova que fomos nós que
 *    começamos o fluxo. Sem isso, qualquer um poderia mandar o navegador do
 *    dono para cá com o slug de outra loja.
 * 2. **O nonce guardado no banco daquela loja** prova que é ESTA tentativa, e
 *    não uma URL antiga repetida.
 * 3. **O Bling** só entrega tokens para o `code` que ele mesmo emitiu, e só
 *    uma vez.
 *
 * O nonce é apagado antes da troca do código, não depois: se a troca falhar,
 * a tentativa já foi gasta de qualquer jeito, e deixar o nonce vivo
 * permitiria repetir a URL.
 */

function paginaDeResposta(titulo: string, detalhe: string, deuCerto: boolean): NextResponse {
  // O HTML e montado (e ESCAPADO) em lib/bling/pagina-de-resposta.ts. Nao
  // montar marcacao aqui: o detalhe pode conter o parametro `error` da URL.
  return new NextResponse(montarHtmlDeResposta(titulo, detalhe, deuCerto), {
    status: deuCerto ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP_DA_PAGINA_DE_RESPOSTA,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const parametros = request.nextUrl.searchParams;

  const recusa = parametros.get("error");
  if (recusa) {
    return paginaDeResposta(
      "Autorização não concluída",
      `O Bling não autorizou a conexão: ${recusa}. Nada foi alterado.`,
      false
    );
  }

  const codigo = parametros.get("code");
  const estadoBruto = parametros.get("state");

  if (!codigo || !estadoBruto) {
    return paginaDeResposta(
      "Faltou informação na volta",
      "O Bling devolveu o navegador sem o código de autorização. Tente conectar de novo.",
      false
    );
  }

  const estado = lerEstado(estadoBruto);
  if (!estado) {
    return paginaDeResposta(
      "Não reconheci esta autorização",
      "O identificador desta tentativa não confere. Comece de novo pelas configurações do Konext.",
      false
    );
  }

  const tenant = await abrirTenantPorSlug(estado.slug);
  if (!tenant) {
    return paginaDeResposta("Loja não encontrada", "A loja desta autorização não existe mais.", false);
  }

  const integracao = tenant.prisma as unknown as {
    integracaoBling?: {
      findFirst: (args?: unknown) => Promise<{
        id: string;
        estadoPendente: string | null;
        estadoPendenteEm: Date | null;
      } | null>;
      update: (args: unknown) => Promise<unknown>;
    };
  };

  const pendente = await integracao.integracaoBling?.findFirst({
    orderBy: { conectadoEm: "asc" },
    select: { id: true, estadoPendente: true, estadoPendenteEm: true },
  });

  if (!pendente?.estadoPendente || pendente.estadoPendente !== estado.nonce) {
    return paginaDeResposta(
      "Esta autorização já foi usada",
      "Comece de novo pelas configurações do Konext. Isso também acontece quando o link fica aberto por muito tempo.",
      false
    );
  }

  if (!pendente.estadoPendenteEm || estadoExpirou(pendente.estadoPendenteEm)) {
    return paginaDeResposta(
      "A autorização demorou demais",
      "Por segurança, a tentativa expirou. Comece de novo pelas configurações do Konext.",
      false
    );
  }

  // Gasta o nonce ANTES de trocar o código: se a troca falhar, a tentativa já
  // foi consumida de qualquer forma, e deixá-lo vivo permitiria repetir a URL.
  await integracao.integracaoBling?.update({
    where: { id: pendente.id },
    data: { estadoPendente: null, estadoPendenteEm: null },
  });

  try {
    const urlBase = await urlBaseDaRequisicao();
    const tokens = await trocarCodigoPorTokens({ codigo, urlBase });

    await salvarConexaoNova({ prisma: tenant.prisma, tokens, conectadoPor: null });

    return paginaDeResposta(
      "Bling conectado",
      "As notas emitidas no Bling vão aparecer no Konext. Nada é emitido ou alterado lá — a conexão é só de leitura.",
      true
    );
  } catch (erro) {
    return paginaDeResposta(
      "Não consegui concluir a conexão",
      erro instanceof Error ? erro.message : "Erro desconhecido ao falar com o Bling.",
      false
    );
  }
}
