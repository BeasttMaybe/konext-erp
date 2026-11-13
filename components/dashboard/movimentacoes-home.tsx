import Link from "next/link";
import type { LinhaMovimentacaoHome } from "@/app/actions/dashboard";
import { Painel } from "@/components/ui/painel";
import { CabecalhoCard } from "./cabecalho-card";
import { PilulaStatus } from "@/components/ui/pilula-status";
import {
  Table,
  TabelaVazia,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarMoeda } from "@/components/ui/pagina";

type MovimentacoesHomeProps = {
  itens: LinhaMovimentacaoHome[];
};

const COLUNAS = 5;

/** Últimas movimentações (Fase 3-2A) — OS + PDV, sempre visível independente de `dashboard.financeiro`. */
export function MovimentacoesHome({ itens }: MovimentacoesHomeProps) {
  return (
    <Painel>
      <CabecalhoCard
        titulo="Últimas movimentações"
        acao={
          <Link href="/os?modo=kanban" className="hover:text-kx-texto">
            Ver OS ↗
          </Link>
        }
      />

      {/* Celular: uma linha por movimentacao (referencia + cliente a esquerda,
          valor e status a direita), tocavel. Cinco colunas nao cabiam. */}
      <ul className="divide-y divide-kx-painel-borda md:hidden">
        {itens.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-kx-legenda">Nenhuma movimentação recente.</li>
        ) : (
          itens.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kx-foco">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-kx-texto">{item.referencia}</span>
                  <span className="block truncate text-sm text-kx-legenda">
                    {[item.cliente, item.descricao].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums text-kx-texto">{formatarMoeda(item.valor)}</span>
                  <PilulaStatus variante={item.variante}>{item.status}</PilulaStatus>
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>

      <div className="hidden px-kx-2 pb-kx-2 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referência</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody zebra>
            {itens.length === 0 ? (
              <TabelaVazia
                colSpan={COLUNAS}
                titulo="Nenhuma movimentação recente"
                descricao="OS e vendas aparecem aqui assim que forem registradas."
              />
            ) : (
              itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={item.href} className="font-medium text-kx-texto hover:underline">
                      {item.referencia}
                    </Link>
                  </TableCell>
                  <TableCell className="text-kx-texto-2">{item.cliente}</TableCell>
                  <TableCell className="max-w-[14rem] truncate text-kx-texto-2">{item.descricao}</TableCell>
                  <TableCell>
                    <PilulaStatus variante={item.variante}>{item.status}</PilulaStatus>
                  </TableCell>
                  <TableCell numerico>{formatarMoeda(item.valor)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Painel>
  );
}
