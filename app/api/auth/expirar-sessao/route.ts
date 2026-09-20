import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO_CENTRAL } from "@/lib/auth/cookies";

/**
 * GET /api/auth/expirar-sessao
 *
 * Único lugar que apaga o cookie de sessão central quando uma sessão se
 * revela inválida/expirada (`exigirSessaoCentral`, lib/auth/sessao-central.ts)
 * redireciona pra cá em vez de apagar o cookie ele mesmo. Motivo: cookies só
 * podem ser mutados numa Server Action ou num Route Handler — e
 * `exigirSessaoCentral` é chamada tanto de dentro de Server Actions quanto
 * (via `exigirContextoTenant`) da renderização comum de Server Components
 * (todo layout/página protegida), onde mutar cookie direto derruba a página
 * com "Cookies can only be modified in a Server Action or Route Handler" em
 * vez de mandar pro login. Um Route Handler funciona nos dois casos por
 * igual, então essa indireção resolve o crash sem precisar distinguir de
 * onde a chamada veio.
 */
export async function GET(request: NextRequest) {
  const resposta = NextResponse.redirect(new URL("/login?expirada=1", request.url));
  resposta.cookies.delete(COOKIE_SESSAO_CENTRAL);
  return resposta;
}
