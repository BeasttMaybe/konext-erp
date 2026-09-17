import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO_CENTRAL, COOKIE_SESSAO_LEGADA } from "@/lib/auth/cookies";

// Rotas publicas explicitas. Todo o restante exige sessao central.
//
// `/rastreio/[id]` (acompanhamento de OS pelo cliente) continua EXIGINDO
// sessao por enquanto, mesmo sendo pensada para acesso publico — o modelo de
// acesso por token da Fase 1C ainda nao existe. Nao adicionar aqui sem
// aquele mecanismo: isso abriria os dados da OS (cliente, aparelho, itens)
// para qualquer um com o link, sem nenhum controle.
const ROTAS_PUBLICAS = ["/login"] as const;

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
