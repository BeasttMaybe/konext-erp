"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Wrench } from "lucide-react";

import {
  listarOrdensProntasParaPDV,
  type OrdemProntaParaPDV,
} from "@/app/actions/os-para-pdv";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deDecimal, formatarReais } from "@/lib/dinheiro";
import { casaComBusca, prepararTermoDeBusca } from "@/lib/dominio/financeiro/busca-de-conta";

/**
 * Escolher a OS a faturar, sem sair do balcão.
 *
 * Antes, "Vincular OS · F4" só mostrava um aviso: abra a OS e use "Enviar
 * para o PDV" por lá. O caminho existia e funcionava, mas pedia ao operador
 * que saísse do PDV, achasse a OS numa lista, clicasse e voltasse — com o
 * cliente parado na frente dele.
 *
 * A lista mostra o que decide a escolha numa olhada: número, cliente,
 * aparelho e valor. Aparelho porque é assim que o cliente se apresenta no
 * balcão ("vim buscar o iPhone"), não pelo número da OS.
 */

type Props = {
  aoFechar: () => void;
  aoEscolher: (osId: string) => void;
};

/**
 * Este componente é MONTADO quando abre e desmontado quando fecha (ver quem
 * o usa). Isso resolve duas coisas de uma vez: o estado — lista, erro e
 * texto da busca — nasce limpo a cada abertura sem nenhum `setState` de
 * reset, e a busca sempre começa vazia em vez de guardar o que foi digitado
 * da vez anterior.
 *
 * Zerar estado dentro do efeito é o que o `react-hooks/set-state-in-effect`
 * recusa, com razão: é um render a mais e uma fonte de estado duplicada.
 */
export function DialogoVincularOS({ aoFechar, aoEscolher }: Props) {
  const [ordens, setOrdens] = useState<OrdemProntaParaPDV[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;

    void listarOrdensProntasParaPDV()
      .then((lista) => {
        if (ativo) setOrdens(lista);
      })
      .catch(() => {
        if (ativo) setErro("Não consegui carregar as ordens de serviço.");
      });

    return () => {
      ativo = false;
    };
  }, []);

  const visiveis = useMemo(() => {
    const palavras = prepararTermoDeBusca(busca);

    return (ordens ?? []).filter((ordem) =>
      casaComBusca(palavras, [
        String(ordem.numeroOs),
        ordem.clienteNome,
        ordem.equipamento,
      ])
    );
  }, [ordens, busca]);

  return (
    <Dialog
      open
      onOpenChange={(estaAberto) => {
        if (!estaAberto) aoFechar();
      }}
    >
      {/* `[&>*]:min-w-0` porque DialogContent é um grid, e item de grid não
          encolhe abaixo do conteúdo por padrão — sem isso, um nome de cliente
          longo estoura a largura do diálogo. */}
      <DialogContent className="max-w-xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Vincular ordem de serviço</DialogTitle>
          <DialogDescription>
            Ordens prontas e ainda não faturadas. Clique para trazer os itens ao balcão.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda"
            aria-hidden
          />
          <Input
            autoFocus
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Número da OS, cliente ou aparelho"
            className="h-10 pl-9"
            aria-label="Buscar ordem de serviço"
          />
        </div>

        <div className="max-h-[22rem] space-y-1.5 overflow-y-auto">
          {ordens === null && !erro && (
            <p className="flex items-center gap-2 py-8 text-center text-sm text-kx-legenda">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando ordens…
            </p>
          )}

          {erro && <p className="py-8 text-center text-sm text-kx-erro-texto">{erro}</p>}

          {ordens !== null && ordens.length === 0 && (
            <div className="py-8 text-center">
              <Wrench className="mx-auto h-6 w-6 text-kx-legenda" aria-hidden />
              <p className="mt-2 text-sm text-kx-texto-2">Nenhuma OS pronta para faturar.</p>
              <p className="mt-0.5 text-xs text-kx-legenda">
                Só aparecem aqui as ordens com status Pronto que ainda não viraram venda.
              </p>
            </div>
          )}

          {ordens !== null && ordens.length > 0 && visiveis.length === 0 && (
            <p className="py-8 text-center text-sm text-kx-legenda">
              Nenhuma OS com esse texto.
            </p>
          )}

          {visiveis.map((ordem) => (
            <button
              key={ordem.id}
              type="button"
              disabled={!ordem.podeFaturar}
              onClick={() => aoEscolher(ordem.id)}
              className="flex w-full flex-col gap-1 rounded-kx-cartao border border-kx-painel-borda bg-kx-superficie px-3 py-2.5 text-left transition-colors hover:border-kx-primaria disabled:cursor-not-allowed disabled:hover:border-kx-painel-borda"
            >
              {/* A opacidade apaga SÓ a identificação da OS — é o que diz
                  "não dá para clicar". O motivo fica fora dela, porque
                  escrever o motivo e então apagá-lo é não escrever: a 60%
                  ele cai a 2,3:1 de contraste no tema claro, num texto de
                  12px. */}
              <span
                className={`flex w-full items-center gap-3 ${
                  ordem.podeFaturar ? "" : "opacity-60"
                }`}
              >
                <span className="shrink-0 rounded-kx-pilula border border-kx-painel-borda px-2 py-0.5 text-xs font-bold tabular-nums text-kx-texto-2">
                  #{ordem.numeroOs}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-kx-texto">
                    {ordem.clienteNome}
                  </span>
                  <span className="block truncate text-xs text-kx-legenda">
                    {ordem.equipamento ?? "Sem aparelho"}
                  </span>
                </span>

                <span className="shrink-0 text-sm font-bold tabular-nums text-kx-texto">
                  {formatarReais(deDecimal(ordem.valorTotal))}
                </span>
              </span>

              {/* À vista, não num `title`: quem está no balcão não passa o
                  mouse para descobrir por que um item da lista não responde. */}
              {ordem.motivoBloqueio && (
                <span className="block text-xs font-medium text-kx-alerta-texto">
                  {ordem.motivoBloqueio}
                </span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
