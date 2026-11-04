import { redirect } from "next/navigation";

/**
 * O histórico de vendas virou a própria tela de Vendas.
 *
 * Este arquivo continua existindo só pra não quebrar o que já aponta pra cá:
 * link guardado nos favoritos, o `router.push` do formulário de pedido novo,
 * e qualquer `revalidatePath` que eu tenha deixado passar. O redirecionamento
 * leva os filtros junto — cair numa lista sem o período que a pessoa tinha
 * escolhido seria pior do que não redirecionar.
 */
export default async function HistoricoRedirecionado({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [chave, valor] of Object.entries(params)) {
    if (typeof valor === "string") query.set(chave, valor);
    // Parâmetro repetido na URL chega como lista; o primeiro é o que as
    // telas deste projeto leem (ver `getSingleParam`).
    else if (Array.isArray(valor) && valor[0]) query.set(chave, valor[0]);
  }

  const textoDaQuery = query.toString();

  redirect(textoDaQuery ? `/vendas?${textoDaQuery}` : "/vendas");
}
