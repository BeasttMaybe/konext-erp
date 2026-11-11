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

      <div className="px-kx-2 pb-kx-2">
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
