"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Receipt, Wrench } from "lucide-react";

import {
  obterHistoricoDoCliente,
  type HistoricoDoCliente,
  type ItemDoHistorico,
} from "@/app/actions/historico-do-cliente";
import { deDecimal, formatarReais } from "@/lib/dinheiro";

/**
 * O que este cliente já trouxe e já comprou, dentro do próprio cadastro.
 *
 * O caso real é o balcão: o cliente chega dizendo que o aparelho voltou a dar
 * problema, e quem atende precisa saber o que foi feito antes — e quando.
 * Antes disso, era sair do cadastro, ir em Ordens de Serviço e procurar pelo
 * nome, torcendo para ter escrito igual.
 *
 * É MONTADO quando o painel do cliente abre (ver o uso em `crm/page.tsx`),
 * e por isso busca uma vez, sem precisar re-sincronizar estado em efeito
 * quando o cliente muda.
 */

function formatarData(iso: string): string {
  // Data de calendário, sem hora: no histórico o que importa é o dia.
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function LinhaDoHistorico({ item }: { item: ItemDoHistorico }) {
  const destino = item.tipo === "os" ? `/os/${item.id}` : `/vendas?venda=${item.id}`;
  const Icone = item.tipo === "os" ? Wrench : Receipt;

  return (
    <li>
      <Link
        href={destino}
        className="flex items-center gap-3 rounded-kx-botao border border-kx-painel-borda bg-kx-cartao px-3 py-2.5 transition-colors hover:border-kx-destaque"
      >
        <Icone className="h-4 w-4 shrink-0 text-kx-legenda" aria-hidden />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-kx-texto">{item.referencia}</span>
            <span className="text-xs text-kx-legenda">{formatarData(item.data)}</span>
          </span>
          <span className="block truncate text-xs text-kx-legenda">
            {item.descricao} · {item.situacao}
          </span>
        </span>

        {/* Riscado quando não vale dinheiro: uma venda estornada continua
            fazendo parte do histórico do cliente, mas o valor dela não é
            dinheiro que entrou. Esconder a linha apagaria o fato de que a
            venda existiu; mostrar o valor normal mentiria sobre ele. */}
        <span
          className={`shrink-0 text-sm font-bold tabular-nums ${
            item.anulado ? "text-kx-legenda line-through" : "text-kx-texto"
          }`}
        >
          {formatarReais(deDecimal(item.valor))}
        </span>
      </Link>
    </li>
  );
}

export function HistoricoDoClientePainel({ clienteId }: { clienteId: string }) {
  const [historico, setHistorico] = useState<HistoricoDoCliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    void obterHistoricoDoCliente(clienteId)
      .then((resultado) => {
        if (ativo) setHistorico(resultado);
      })
      .catch(() => {
        if (ativo) setErro("Não consegui carregar o histórico deste cliente.");
      });

    return () => {
      ativo = false;
    };
  }, [clienteId]);

  if (erro) {
    return <p className="py-4 text-sm text-kx-erro-texto">{erro}</p>;
  }

  if (!historico) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-kx-legenda">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando histórico…
      </p>
    );
  }

  if (historico.itens.length === 0) {
    return (
      <p className="py-4 text-sm text-kx-legenda">
        Nenhuma ordem de serviço ou venda no nome deste cliente ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-kx-legenda">
        <span>
          <strong className="text-kx-texto">{historico.quantidadeOs}</strong>{" "}
          {historico.quantidadeOs === 1 ? "ordem de serviço" : "ordens de serviço"}
        </span>
        <span>
          <strong className="text-kx-texto">{historico.quantidadeVendas}</strong>{" "}
          {historico.quantidadeVendas === 1 ? "venda" : "vendas"}
        </span>
        <span>
          Total:{" "}
          <strong className="text-kx-texto">
            {formatarReais(deDecimal(historico.totalGasto))}
          </strong>
        </span>
      </div>

      <ul className="max-h-80 space-y-1.5 overflow-y-auto">
        {historico.itens.map((item) => (
          <LinhaDoHistorico key={`${item.tipo}-${item.id}`} item={item} />
        ))}
      </ul>
    </div>
  );
}
