import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESSAO } from "~/lib/regras";

/**
 * Porta da frente: sem cookie de sessao, tudo leva ao /login. A sessao em si
 * (valida, nao revogada, administrador ativo) e conferida no servidor por
 * exigirAdministrador() em cada pagina e action do painel.
 */
export function proxy(requisicao: NextRequest) {
  const { pathname } = requisicao.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  if (!requisicao.cookies.get(COOKIE_SESSAO)?.value) {
    return NextResponse.redirect(new URL("/login", requisicao.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
