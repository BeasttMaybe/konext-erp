import { NextRequest, NextResponse } from "next/server";

import { trocarCodigoPorTokens } from "@/lib/bling/api";
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
  // HTML mínimo e autocontido: é uma página de passagem, vista uma vez por
  // conexão. Carregar o shell do app aqui só atrasaria a volta para as
  // configurações.
  //
  // As cores são as PALAVRAS-CHAVE DE SISTEMA do CSS (`Canvas`, `CanvasText`,
  // `AccentColor`…), não hex. Esta página roda fora do shell, então não
  // alcança os tokens `--kx-*` — e cravar hex aqui criaria uma segunda
  // paleta, solta, que ninguém lembraria de atualizar. As palavras de sistema
  // já acompanham o tema claro/escuro do aparelho sozinhas, que é tudo o que
  // uma tela de passagem precisa.
  const corpo = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background:Canvas; color:CanvasText; padding:24px; }
  .cartao { max-width:30rem; text-align:center; border:1px solid; border-color:GrayText;
            border-radius:16px; padding:32px 24px; }
  h1 { font-size:1.25rem; margin:0 0 8px; }
  p { margin:0 0 20px; color:GrayText; line-height:1.5; }
  a { display:inline-block; background:${deuCerto ? "AccentColor" : "ButtonFace"};
      color:${deuCerto ? "AccentColorText" : "ButtonText"};
      text-decoration:none; padding:10px 18px; border-radius:10px; font-weight:600; }
</style></head>
<body><div class="cartao">
  <h1>${titulo}</h1>
  <p>${detalhe}</p>
  <a href="/configuracoes">Voltar para as configurações</a>
</div></body></html>`;

  return new NextResponse(corpo, {
    status: deuCerto ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
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
