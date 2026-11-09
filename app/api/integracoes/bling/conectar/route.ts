import { NextResponse } from "next/server";

import { exigirPermissao } from "@/lib/auth/permissoes";
import { blingEstaConfigurado, montarUrlDeAutorizacao } from "@/lib/bling/api";
import { criarEstado } from "@/lib/bling/estado-oauth";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { urlBaseDaRequisicao } from "@/lib/url-da-requisicao";

/**
 * GET /api/integracoes/bling/conectar
 *
 * Começa a autorização: guarda o nonce desta tentativa e manda o dono para o
 * Bling.
 *
 * É rota, e não server action, porque o fim dela é um REDIRECIONAMENTO do
 * navegador para outro domínio — que é exatamente o que uma action não faz.
 *
 * Aqui ainda existe sessão, então é aqui que a permissão é conferida. Do
 * outro lado, no callback, não há sessão nenhuma: quem volta é o navegador
 * vindo do Bling, e é por isso que o `state` precisa ser assinado.
 */
export async function GET() {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "configuracoes.sistema");

  if (!blingEstaConfigurado()) {
    return NextResponse.json(
      { erro: "BLING_CLIENT_ID e BLING_CLIENT_SECRET não estão configurados no ambiente." },
      { status: 503 }
    );
  }

  const urlBase = await urlBaseDaRequisicao();
  if (!urlBase) {
    return NextResponse.json({ erro: "Não consegui descobrir o endereço do site." }, { status: 500 });
  }

  const { nonce, estado } = criarEstado(contexto.tenantSlug);

  // O nonce fica guardado no banco DESTA loja. O callback vai chegar sem
  // sessão, descobrir a loja pela assinatura do estado, e só então conferir
  // que o nonce bate — a assinatura prova que o estado é nosso, o nonce prova
  // que é desta tentativa e não de uma repetida.
  const integracao = contexto.prisma as unknown as {
    integracaoBling?: {
      findFirst: (args?: unknown) => Promise<{ id: string } | null>;
      update: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
    };
  };

  const existente = await integracao.integracaoBling?.findFirst({
    orderBy: { conectadoEm: "asc" },
    select: { id: true },
  });

  if (existente) {
    await integracao.integracaoBling?.update({
      where: { id: existente.id },
      data: { estadoPendente: nonce, estadoPendenteEm: new Date() },
    });
  } else {
    // Linha provisória: ela existe só para guardar o nonce enquanto o dono
    // está no Bling. Os tokens vazios aqui nunca chegam a ser usados — o
    // callback substitui a linha inteira ao salvar a conexão de verdade, e
    // `obterAccessTokenValido` só é chamado depois disso.
    await integracao.integracaoBling?.create({
      data: {
        accessToken: "",
        refreshToken: "",
        expiraEm: new Date(0),
        estadoPendente: nonce,
        estadoPendenteEm: new Date(),
      },
    });
  }

  return NextResponse.redirect(montarUrlDeAutorizacao({ urlBase, estado }));
}
