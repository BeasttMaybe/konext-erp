import { notFound, redirect } from "next/navigation";

import {
  FormularioDeProposta,
  type PropostaParaEditar,
} from "@/components/crm/propostas/formulario-de-proposta";
import { deDecimal, paraMoeda } from "@/lib/dinheiro";
import { podeEditar, type StatusProposta } from "@/lib/dominio/propostas/situacao";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";

/**
 * Editar uma proposta já criada.
 *
 * A tela é o MESMO formulário de "nova proposta" — ver
 * `components/crm/propostas/formulario-de-proposta`. O que esta página faz é
 * só carregar o documento e traduzi-lo de volta para o formato do formulário.
 *
 * A trava de quem pode ser editada é conferida aqui E na action. Aqui porque
 * é feio deixar a pessoa preencher para recusar no fim; na action porque a
 * tela não é segurança — a regra que vale é a do servidor.
 */

type Props = { params: Promise<{ id: string }> };

/** Data de calendário (meia-noite UTC) de volta para o `yyyy-mm-dd` do input. */
function paraCampoDeData(valor: Date | null): string {
  return valor ? valor.toISOString().slice(0, 10) : "";
}

/**
 * `condicoesPagamento` guarda os dois campos do formulário juntos, separados
 * por " | " (ver `montarResumoDePagamento`). Desfaz para a edição.
 *
 * Só a PRIMEIRA barra separa: um detalhe de pagamento pode conter " | ", e
 * cortar em todas jogaria fora o que vem depois da segunda.
 */
function separarPagamento(valor: string | null): {
  condicoesPagamento: string;
  detalhesPagamento: string;
} {
  if (!valor) return { condicoesPagamento: "", detalhesPagamento: "" };

  const corte = valor.indexOf(" | ");
  if (corte === -1) return { condicoesPagamento: valor, detalhesPagamento: "" };

  return {
    condicoesPagamento: valor.slice(0, corte),
    detalhesPagamento: valor.slice(corte + 3),
  };
}

export default async function EditarPropostaPage({ params }: Props) {
  const { id } = await params;

  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "propostas.editar");

  const proposta = await contexto.prisma.propostaComercial.findUnique({
    where: { id },
    include: { itens: { orderBy: { criadoEm: "asc" } } },
  });

  if (!proposta) notFound();

  // Respondida pelo cliente não se edita: volta para o detalhe, onde o menu
  // oferece "Duplicar", que é o caminho certo.
  if (!podeEditar(proposta.status as StatusProposta)) {
    redirect(`/crm/propostas/${id}`);
  }

  const pagamento = separarPagamento(proposta.condicoesPagamento);

  const valores: PropostaParaEditar["valores"] = {
    cliente: proposta.cliente,
    aosCuidados: proposta.aosCuidados ?? "",
    dataEmissao: paraCampoDeData(proposta.dataEmissao),
    validade: paraCampoDeData(proposta.validade),
    proximoContato: paraCampoDeData(proposta.proximoContato),
    equipamento: proposta.equipamento ?? "",
    defeito: proposta.defeito ?? "",
    introducao: proposta.introducao ?? "",
    condicoesPagamento: pagamento.condicoesPagamento,
    detalhesPagamento: pagamento.detalhesPagamento,
    termosGarantia: proposta.termosGarantia ?? "",
    observacoesInternas: proposta.observacoesInternas ?? "",
    itens: proposta.itens.map((item) => ({
      descricao: item.descricao,
      quantidade: item.quantidade,
      // O banco guarda Decimal; o formulário trabalha em reais. A conversão
      // passa por lib/dinheiro.ts, como todo dinheiro deste projeto.
      precoUnitario: paraMoeda(deDecimal(item.precoUnitario)),
      descontoPercentual: item.descontoPercentual,
    })),
  };

  return (
    <FormularioDeProposta
      proposta={{
        id: proposta.id,
        atualizadoEm: proposta.atualizadoEm.toISOString(),
        valores,
      }}
    />
  );
}
