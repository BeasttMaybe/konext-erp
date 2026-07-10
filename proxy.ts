import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO_CENTRAL, COOKIE_SESSAO_LEGADA } from "@/lib/auth/cookies";

// Rotas publicas explicitas. Todo o restante exige sessao central.
const ROTAS_PUBLICAS = ["/login"] as const;

function rotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export function proxy(request: NextRequest) {
  const sessaoCentral = request.cookies.get(COOKIE_SESSAO_CENTRAL)?.value;
  const { pathname } = request.nextUrl;

  const rotaApi = pathname.startsWith("/api/");

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
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
