import { AlarmClock, CalendarX, Percent, Wallet } from "lucide-react";

import type { IndicadoresPropostas } from "@/app/actions/propostas";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Indicadores do topo das Propostas.
 *
 * Quatro, e cada um existe por uma pergunta que se faz olhando a tela:
 *
 * - quanto ainda pode entrar (valor em aberto);
 * - o que eu ligo hoje (vencendo + contato atrasado);
 * - o que eu já perdi por não ter ligado (vencidas);
 * - de cada dez orçamentos, quantos eu fecho (conversão).
 *
 * O que ficou de fora de propósito: "total de propostas" e "quantas aprovadas"
 * são contagens que a própria lista logo abaixo mostra, e um cartão que repete
 * a lista só gasta a primeira tela.
 *
 * A taxa de conversão é o indicador NOVO — não existia porque o dado não
 * existia: nenhuma ação do sistema conseguia marcar uma proposta como aprovada
 * ou recusada. Enquanto ninguém responder nada, ela não aparece: "0%" ali
 * seria o pior número possível, e falso.
 */
export function IndicadoresPropostas({ dados }: { dados: IndicadoresPropostas }) {
  const precisamLigacao = dados.vencendo + dados.contatosAtrasados;

  const cartoes = [
    {
      chave: "aberto",
      rotulo: "Em aberto",
      valor: formatarMoeda(dados.valorEmAberto),
      detalhe:
        dados.emAberto === 1
          ? "1 proposta esperando resposta"
          : `${dados.emAberto} propostas esperando resposta`,
      icone: Wallet,
      classeIcone: "text-kx-info-icone",
      classeCartao: "border-kx-painel-borda bg-kx-cartao",
    },
    {
      chave: "ligar",
      rotulo: "Ligar hoje",
      valor: String(precisamLigacao),
      detalhe:
        dados.contatosAtrasados > 0
          ? `${dados.vencendo} vencendo · ${dados.contatosAtrasados} com contato marcado`
          : "Vencem hoje ou nos próximos dias",
      icone: AlarmClock,
      classeIcone: "text-kx-alerta-icone",
      classeCartao:
        precisamLigacao > 0
          ? "border-kx-alerta bg-kx-alerta-fundo"
          : "border-kx-painel-borda bg-kx-cartao",
    },
    {
      chave: "vencidas",
      rotulo: "Venceram sem resposta",
      valor: String(dados.vencidas),
      detalhe: "Ainda dá pra recuperar com um telefonema",
      icone: CalendarX,
      classeIcone: "text-kx-erro-icone",
      classeCartao:
        dados.vencidas > 0
          ? "border-kx-erro-borda bg-kx-erro-fundo"
          : "border-kx-painel-borda bg-kx-cartao",
    },
    dados.taxaDeConversao !== null
      ? {
          chave: "conversao",
          rotulo: "Conversão",
          valor: `${dados.taxaDeConversao.toFixed(0)}%`,
          detalhe: `${dados.aprovadas} fechadas de ${dados.aprovadas + dados.rejeitadas} respondidas`,
          icone: Percent,
          classeIcone: "text-kx-sucesso-icone",
          classeCartao: "border-kx-sucesso bg-kx-sucesso-fundo",
        }
      : {
          chave: "conversao",
          rotulo: "Conversão",
          valor: "—",
          detalhe: "Aparece quando a primeira proposta for respondida",
          icone: Percent,
          classeIcone: "text-kx-legenda",
          classeCartao: "border-kx-painel-borda bg-kx-cartao",
        },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cartoes.map((cartao) => {
        const Icone = cartao.icone;

        return (
          <div key={cartao.chave} className={`rounded-kx-cartao border p-4 ${cartao.classeCartao}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-kx-legenda">
                {cartao.rotulo}
              </p>
              <Icone className={`h-4 w-4 shrink-0 ${cartao.classeIcone}`} aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-kx-texto">{cartao.valor}</p>
            <p className="mt-1 text-xs text-kx-legenda">{cartao.detalhe}</p>
          </div>
        );
      })}
    </div>
  );
}
