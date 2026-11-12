"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Clock3, ShieldCheck } from "lucide-react";

import { PilulaStatus } from "@/components/ui/pilula-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TabelaVazia } from "@/components/ui/table";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import {
  aparelhoDaOS,
  contarPorFiltro,
  DIAS_PARA_DESTACAR_PARADA,
  diasParada,
  FILTROS_DA_LISTA,
  montarLista,
  proximaOrdenacao,
  tecnicoPrincipal,
  type ColunaOrdenavel,
  type Direcao,
  type FiltroDaLista,
} from "@/lib/dominio/os/lista-de-os";
import { CLASSES_ETAPA_OS, ROTULOS_ETAPA_OS, ROTULOS_SITUACAO_OS } from "@/lib/dominio/os/maquina-estados";
import { cn } from "@/lib/utils";
import type { OrdemServico } from "@/types/os";

const ROTULO_DO_FILTRO: Record<FiltroDaLista, string> = {
  TODAS: "Todas",
  ...ROTULOS_ETAPA_OS,
  GARANTIA: "Garantia",
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarData = (iso: string, fusoHorario: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: fusoHorario }).format(
    new Date(iso)
  );

/**
 * As OS em andamento em LISTA — a alternativa ao quadro, no formato do hub
 * de OS do Bling. Mesmos dados do quadro (nenhuma consulta a mais); cada
 * linha abre a OS, onde ficam as acoes (mover, finalizar, entregar).
 *
 * O que a lista mostra que o quadro nao mostra: o valor de cada OS lado a
 * lado, a data de entrada, e ha quantos dias a OS nao se mexe — a OS
 * esquecida na bancada aparece no topo ao ordenar por "Parada".
 */
export function ListaOSEmAndamento({
  ordens,
  onAbrir,
  fusoHorario = FUSO_HORARIO_PADRAO,
}: {
  ordens: OrdemServico[];
  onAbrir: (os: OrdemServico) => void;
  fusoHorario?: string;
}) {
  const [filtro, setFiltro] = useState<FiltroDaLista>("TODAS");
  const [ordenacao, setOrdenacao] = useState<{ coluna: ColunaOrdenavel; direcao: Direcao }>({
    coluna: "numero",
    direcao: "desc",
  });
  // "Agora" fixado na montagem: os dias parada nao mudam no meio da leitura.
  const [agora] = useState(() => new Date());

  const contagem = useMemo(() => contarPorFiltro(ordens), [ordens]);
  const linhas = useMemo(
    () => montarLista(ordens, { filtro, ...ordenacao, agora, fusoHorario }),
    [ordens, filtro, ordenacao, agora, fusoHorario]
  );

  const cabecalho = (coluna: ColunaOrdenavel, rotulo: string, alinharDireita = false) => {
    const ativa = ordenacao.coluna === coluna;
    const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead
        className={alinharDireita ? "text-right" : undefined}
        aria-sort={ativa ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => setOrdenacao((atual) => proximaOrdenacao(atual, coluna))}
          className={cn(
            "inline-flex items-center gap-1 rounded-kx-botao font-semibold hover:text-kx-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco",
            ativa ? "text-kx-texto" : "text-kx-legenda",
            alinharDireita && "flex-row-reverse"
          )}
        >
          {rotulo}
          <Icone className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros por etapa, com contagem — o topo do hub do Bling. */}
      <div role="group" aria-label="Filtrar por etapa" className="flex flex-wrap gap-2">
        {FILTROS_DA_LISTA.map((opcao) => {
          const ativo = filtro === opcao;
          return (
            <button
              key={opcao}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltro(opcao)}
              className={cn(
                "inline-flex items-center gap-2 rounded-kx-pilula border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco",
                ativo
                  ? "border-transparent bg-kx-primaria text-primary-foreground"
                  : "border-kx-painel-borda bg-kx-superficie text-kx-texto-2 hover:border-kx-campo-borda hover:text-kx-texto"
              )}
            >
              {ROTULO_DO_FILTRO[opcao]}
              <span
                className={cn(
                  "min-w-6 rounded-kx-pilula px-1.5 text-xs tabular-nums",
                  ativo ? "bg-kx-painel/25" : "bg-kx-cartao text-kx-legenda"
                )}
              >
                {contagem[opcao]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-kx-painel border border-kx-painel-borda">
        {/* Celulas mais justas que o padrao (px-3): sao 7-8 colunas, e a lista
            tem que caber inteira numa tela de notebook sem rolar de lado. */}
        <Table className="[&_td]:px-3 [&_th]:px-3">
          <TableHeader className="bg-kx-superficie">
            <TableRow>
              {cabecalho("numero", "Nº OS")}
              {cabecalho("entrada", "Entrada")}
              {cabecalho("cliente", "Cliente")}
              <TableHead>Aparelho</TableHead>
              <TableHead>Etapa</TableHead>
              {/* Tecnico so em tela larga: e a coluna menos consultada, e a que
                  empurrava "Parada" — a mais util — para fora da tela de notebook. */}
              <TableHead className="hidden 2xl:table-cell">Técnico</TableHead>
              {cabecalho("valor", "Valor", true)}
              {cabecalho("parada", "Parada", true)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TabelaVazia
                colSpan={8}
                titulo="Nenhuma OS nesta etapa"
                descricao={filtro === "TODAS" ? "Ajuste a busca acima." : "Escolha outro filtro acima."}
              />
            ) : (
              linhas.map((os) => {
                const dias = diasParada(os, agora, fusoHorario);
                const parada = dias >= DIAS_PARA_DESTACAR_PARADA;
                return (
                  <TableRow
                    key={os.id}
                    tabIndex={0}
                    onClick={() => onAbrir(os)}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter" || evento.key === " ") {
                        evento.preventDefault();
                        onAbrir(os);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kx-foco"
                    aria-label={`Abrir ${os.numeroOS}, ${os.nomeCliente}`}
                  >
                    <TableCell className="whitespace-nowrap font-bold text-kx-texto">
                      <span className="inline-flex items-center gap-1.5">
                        {os.numeroOS}
                        {os.ehRetornoGarantia ? (
                          <ShieldCheck className="h-4 w-4 text-kx-garantia" aria-label="Retorno de garantia" />
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-kx-texto-2">
                      {formatarData(os.dataCriacao, fusoHorario)}
                    </TableCell>
                    <TableCell className="font-medium text-kx-texto">
                      {/* O corte fica num elemento DENTRO da celula: numa tabela,
                          largura maxima na propria celula e ignorada. */}
                      <div className="max-w-36 truncate 2xl:max-w-56" title={os.nomeCliente}>
                        {os.nomeCliente}
                      </div>
                    </TableCell>
                    <TableCell className="text-kx-texto-2">
                      <div className="max-w-32 truncate 2xl:max-w-44" title={aparelhoDaOS(os)}>
                        {aparelhoDaOS(os)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <PilulaStatus variante={CLASSES_ETAPA_OS[os.etapa].variante}>
                          {ROTULOS_ETAPA_OS[os.etapa]}
                        </PilulaStatus>
                        {os.situacao ? (
                          <PilulaStatus variante="alerta">{ROTULOS_SITUACAO_OS[os.situacao]}</PilulaStatus>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-kx-texto-2 2xl:table-cell">
                      {tecnicoPrincipal(os) ?? <span className="text-kx-legenda">—</span>}
                    </TableCell>
                    <TableCell numerico className="font-semibold text-kx-texto">
                      {os.totalOrcamento > 0 ? formatarMoeda(os.totalOrcamento) : <span className="text-kx-legenda">—</span>}
                    </TableCell>
                    <TableCell numerico>
                      <span
                        className={cn(
                          "inline-flex items-center justify-end gap-1",
                          parada ? "font-semibold text-kx-alerta-texto" : "text-kx-legenda"
                        )}
                        title={parada ? `Sem movimentação há ${dias} dias` : undefined}
                      >
                        {parada ? <Clock3 className="h-3.5 w-3.5" aria-hidden /> : null}
                        {dias === 0 ? "hoje" : dias === 1 ? "1 dia" : `${dias} dias`}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
