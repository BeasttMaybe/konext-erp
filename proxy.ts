import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO_CENTRAL, COOKIE_SESSAO_LEGADA } from "@/lib/auth/cookies";

// Rotas publicas explicitas. Todo o restante exige sessao central.
//
// "/login" cobre tambem "/login/recuperar" pelo match por prefixo em
// `rotaPublica` abaixo.
//
// "/foto" e "/r" SAO PUBLICAS, E NAO ESTAVAM AQUI.
//
// As duas paginas foram escritas para quem nao tem conta: o tecnico aponta o
// celular para o QR code e manda a foto (`/foto/<loja>/<segredo>`), o cliente
// abre o link do WhatsApp e ve o andamento do conserto (`/r/<loja>/<os>`).
// Cada uma se autoriza sozinha — a de foto por um segredo com validade e
// revogacao, a de rastreio pelo id sorteado da OS — e nenhuma le sessao.
//
// So que a lista abaixo tinha apenas "/login". O proxy redirecionava as duas
// para a tela de login antes de a pagina rodar: o link do QR so funcionava
// num celular que ja estivesse logado no sistema, e o link mandado ao cliente
// nunca funcionou para cliente nenhum. O codigo das paginas estava certo e
// testado; faltava a porta estar aberta.
//
// O que NAO entra aqui: "/rastreio/<id>", a rota antiga. Ela nao sabe de que
// loja e a OS e hoje so redireciona quem esta logado para "/r" (ver
// app/rastreio/[id]/page.tsx).
const ROTAS_PUBLICAS = ["/login", "/foto", "/r"] as const;

function rotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

// Extensoes de arquivo estatico servidas de `public/` ou de metadados de
// rota (favicon, manifest, robots, sitemap). `pathname.includes(".")`
// tratava QUALQUER ponto no caminho como asset estatico e liberava a rota
// sem autenticacao — um segmento dinamico como `/os/1.5` ja bastava para
// escapar do proxy (AUDIT_REPORT F-39). Aqui so o FIM do caminho conta.
const EXTENSAO_ASSET_ESTATICO =
  /\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|js|mjs|map|woff2?|ttf|otf|eot|txt|xml|json|webmanifest)$/i;

function assetEstatico(pathname: string): boolean {
  return EXTENSAO_ASSET_ESTATICO.test(pathname);
}

export function proxy(request: NextRequest) {
  const sessaoCentral = request.cookies.get(COOKIE_SESSAO_CENTRAL)?.value;
  const { pathname } = request.nextUrl;

  const rotaApi = pathname.startsWith("/api/");

  if (pathname.startsWith("/_next") || assetEstatico(pathname)) {
    return NextResponse.next();
  }

  // konext_session (legado) nao autentica mais: apenas sessao central conta.
  if (!sessaoCentral && !rotaPublica(pathname) && !rotaApi) {
    const resposta = NextResponse.redirect(new URL("/login", request.url));
    // Higieniza cookie legado residual de sessoes antigas.
    if (request.cookies.get(COOKIE_SESSAO_LEGADA)) {
      resposta.cookies.delete(COOKIE_SESSAO_LEGADA);
    }
    return resposta;
  }

  if (sessaoCentral && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
