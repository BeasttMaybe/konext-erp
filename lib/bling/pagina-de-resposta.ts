import { escaparHtml } from "@/lib/html/escapar";

/**
 * A pagina que o navegador mostra quando volta do Bling.
 *
 * O DEFEITO QUE MORAVA AQUI
 *
 * Esta pagina era montada com `${titulo}` e `${detalhe}` direto no HTML, e o
 * detalhe incluia o parametro `error` da URL:
 *
 *   /api/integracoes/bling/callback?error=<script>…</script>
 *
 * A rota nao exige login (o Bling e quem redireciona para ca), entao bastava
 * mandar esse link para alguem logado no Konext: o script rodava na origem do
 * sistema, com a sessao da pessoa, e podia chamar qualquer action em nome
 * dela — criar usuario, apagar venda, ler cliente. XSS refletido.
 *
 * DUAS CAMADAS
 *
 * 1. Todo texto e escapado AQUI, no ponto em que vira HTML — e nao em quem
 *    chama. Assim a proxima mensagem que alguem acrescentar ja nasce segura,
 *    sem precisar lembrar de escapar.
 * 2. A resposta sai com uma Content-Security-Policy que proibe qualquer
 *    script. Se um dia o escape falhar, o navegador ainda se recusa a
 *    executar.
 */

/** O Bling manda codigos curtos (`access_denied`). Nada legitimo passa disso. */
const TAMANHO_MAXIMO_DO_DETALHE = 300;

export const CSP_DA_PAGINA_DE_RESPOSTA =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function montarHtmlDeResposta(titulo: string, detalhe: string, deuCerto: boolean): string {
  const tituloSeguro = escaparHtml(titulo);
  const detalheSeguro = escaparHtml(detalhe.slice(0, TAMANHO_MAXIMO_DO_DETALHE));

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tituloSeguro}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background:Canvas; color:CanvasText; padding:24px; }
  .cartao { max-width:30rem; text-align:center; border:1px solid; border-color:GrayText;
            border-radius:16px; padding:32px 24px; }
  h1 { font-size:1.25rem; margin:0 0 8px; }
  p { margin:0 0 20px; color:GrayText; line-height:1.5; overflow-wrap:anywhere; }
  a { display:inline-block; background:${deuCerto ? "AccentColor" : "ButtonFace"};
      color:${deuCerto ? "AccentColorText" : "ButtonText"};
      text-decoration:none; padding:10px 18px; border-radius:10px; font-weight:600; }
</style></head>
<body><div class="cartao">
  <h1>${tituloSeguro}</h1>
  <p>${detalheSeguro}</p>
  <a href="/configuracoes">Voltar para as configurações</a>
</div></body></html>`;
}
