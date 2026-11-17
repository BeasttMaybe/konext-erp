"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarOff,
  Check,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Printer,
  Send,
  ShoppingCart,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  agendarProximoContato,
  clonarProposta,
  marcarPropostaComoEnviada,
  responderProposta,
} from "@/app/actions/propostas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// `podeEditar` do domínio chega com outro nome de propósito: neste arquivo
// `podeEditar` já é a PERMISSÃO do usuário. Duas coisas diferentes com o
// mesmo nome no mesmo arquivo é como se escreve um bug que ninguém vê.
import {
  podeEditar as propostaPodeSerEditada,
  podeMarcarComoEnviada,
  podeRegistrarResposta,
  type StatusProposta,
} from "@/lib/dominio/propostas/situacao";

/**
 * Menu de ações de uma proposta.
 *
 * O menu anterior tinha nove itens e QUATRO não faziam nada: "Enviar por
 * e-mail", "Enviar por whatsapp", "Clonar proposta" e "Criar modelo" eram
 * `DropdownMenuItem` sem `onSelect` — clicar fechava o menu e pronto. Item de
 * menu que não faz nada é pior que item ausente: ensina a pessoa a não confiar
 * no menu.
 *
 * Os dois de envio saíram (o dono não usa envio pelo sistema), "Criar modelo"
 * saiu (não existia nada por trás), e "Duplicar" ficou — porque numa
 * assistência o mesmo orçamento se repete muito — agora com uma action de
 * verdade.
 *
 * O que ENTROU é o que faltava: registrar o que o cliente respondeu.
 */
export function MenuProposta({
  propostaId,
  status,
  podeEditar,
  proximoContato,
}: {
  propostaId: string;
  status: StatusProposta;
  podeEditar: boolean;
  proximoContato: string | null;
}) {
  const router = useRouter();
  const [emAndamento, iniciarTransicao] = useTransition();
  const [dialogoResposta, setDialogoResposta] = useState<"APROVADA" | "REJEITADA" | null>(null);
  const [dialogoContato, setDialogoContato] = useState(false);

  const emAberto = podeRegistrarResposta(status);

  const executar = (
    acao: () => Promise<{ sucesso: true; mensagem: string } | { sucesso: false; erro: string }>
  ) => {
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (resultado.sucesso) {
        toast.success(resultado.mensagem);
        router.refresh();
      } else {
        toast.error(resultado.erro);
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {/* Aprovar fica FORA do menu: é a ação que fecha a venda, e enterrar
            ela atrás de três cliques é o que faz ninguém registrar nada — que
            foi exatamente o estado anterior da tela. */}
        {podeEditar && emAberto && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={emAndamento}
            onClick={() => setDialogoResposta("APROVADA")}
            className="hidden border-kx-sucesso text-kx-sucesso-texto hover:bg-kx-sucesso-fundo sm:inline-flex"
          >
            <Check className="h-4 w-4" />
            Aprovar
          </Button>
        )}

        <Button
          asChild
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Ver proposta"
          className="text-kx-texto-2 hover:text-kx-texto"
        >
          <Link href={`/crm/propostas/${propostaId}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Mais ações"
              className="text-kx-texto-2 hover:text-kx-texto"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            {podeEditar && propostaPodeSerEditada(status) && (
              <DropdownMenuItem asChild className="cursor-pointer gap-2">
                <Link href={`/crm/propostas/${propostaId}/editar`}>
                  <Pencil className="h-4 w-4" />
                  Editar proposta
                </Link>
              </DropdownMenuItem>
            )}

            {podeEditar && podeMarcarComoEnviada(status) && (
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => executar(() => marcarPropostaComoEnviada(propostaId))}
              >
                <Send className="h-4 w-4" />
                Marcar como enviada
              </DropdownMenuItem>
            )}

            {podeEditar && emAberto && (
              <>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 sm:hidden"
                  onSelect={() => setDialogoResposta("APROVADA")}
                >
                  <Check className="h-4 w-4 text-kx-sucesso-texto" />
                  Cliente aprovou
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onSelect={() => setDialogoResposta("REJEITADA")}
                >
                  <X className="h-4 w-4 text-kx-erro-texto" />
                  Cliente recusou
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onSelect={() => setDialogoContato(true)}
                >
                  <CalendarClock className="h-4 w-4" />
                  {proximoContato ? "Mudar o próximo contato" : "Marcar próximo contato"}
                </DropdownMenuItem>

                {proximoContato && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => executar(() => agendarProximoContato(propostaId, null))}
                  >
                    <CalendarOff className="h-4 w-4" />
                    Tirar o lembrete de contato
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => router.push(`/os/nova?propostaId=${propostaId}`)}
            >
              <Wrench className="h-4 w-4" />
              Gerar ordem de serviço
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => router.push(`/vendas/pedidos/novo?propostaId=${propostaId}`)}
            >
              <ShoppingCart className="h-4 w-4" />
              Gerar venda
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer gap-2"
              // Abre a impressão em outra aba para não perder a lista de propostas.
              onSelect={() => window.open(`/propostas/${propostaId}/imprimir`, "_blank", "noopener,noreferrer")}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </DropdownMenuItem>

            {podeEditar && (
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() =>
                  iniciarTransicao(async () => {
                    const resultado = await clonarProposta(propostaId);
                    if (resultado.sucesso) {
                      toast.success(resultado.mensagem);
                      router.push(`/crm/propostas/${resultado.propostaId}`);
                    } else {
                      toast.error(resultado.erro);
                    }
                  })
                }
              >
                <Copy className="h-4 w-4" />
                Duplicar como rascunho
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DialogoResposta
        resposta={dialogoResposta}
        emAndamento={emAndamento}
        aoFechar={() => setDialogoResposta(null)}
        aoConfirmar={(motivo) => {
          const resposta = dialogoResposta;
          if (!resposta) return;
          setDialogoResposta(null);
          executar(() => responderProposta({ propostaId, resposta, motivo }));
        }}
      />

      <DialogoContato
        aberto={dialogoContato}
        emAndamento={emAndamento}
        valorInicial={proximoContato ? proximoContato.slice(0, 10) : ""}
        aoFechar={() => setDialogoContato(false)}
        aoConfirmar={(dataIso) => {
          setDialogoContato(false);
          executar(() => agendarProximoContato(propostaId, dataIso));
        }}
      />
    </>
  );
}

/**
 * O motivo é pedido na recusa e opcional na aprovação.
 *
 * Perder por preço e perder por prazo pedem reações opostas, e sem o motivo
 * toda recusa fica igual no histórico — o que é o mesmo que não ter histórico.
 * Mas é campo de texto livre e não obrigatório: exigir preenchimento é o jeito
 * mais rápido de fazer a pessoa parar de registrar as recusas, e aí se perde
 * também a taxa de conversão.
 */
function DialogoResposta({
  resposta,
  emAndamento,
  aoFechar,
  aoConfirmar,
}: {
  resposta: "APROVADA" | "REJEITADA" | null;
  emAndamento: boolean;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const recusa = resposta === "REJEITADA";

  return (
    <Dialog
      open={resposta !== null}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setMotivo("");
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{recusa ? "Cliente recusou" : "Cliente aprovou"}</DialogTitle>
          <DialogDescription>
            {recusa
              ? "A proposta sai da lista de abertas e passa a contar na taxa de conversão."
              : "Depois de aprovar, dá pra gerar a ordem de serviço direto da proposta."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo-resposta">
            {recusa ? "Por que não fechou? (opcional)" : "Alguma observação? (opcional)"}
          </Label>
          <Textarea
            id="motivo-resposta"
            value={motivo}
            maxLength={500}
            rows={3}
            placeholder={recusa ? "Achou caro, vai fazer em outro lugar..." : ""}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
          {recusa && (
            <p className="text-xs text-kx-legenda">
              Guardar o motivo é o que permite, depois, saber se você perde por preço ou por prazo.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={emAndamento}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={emAndamento}
            onClick={() => {
              aoConfirmar(motivo);
              setMotivo("");
            }}
          >
            {recusa ? "Registrar recusa" : "Registrar aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoContato({
  aberto,
  emAndamento,
  valorInicial,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  emAndamento: boolean;
  valorInicial: string;
  aoFechar: () => void;
  aoConfirmar: (dataIso: string) => void;
}) {
  const [data, setData] = useState(valorInicial);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estaAberto) => {
        if (!estaAberto) aoFechar();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Próximo contato</DialogTitle>
          <DialogDescription>
            No dia marcado, a proposta sobe pro topo da lista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="data-proximo-contato">Data</Label>
          <Input
            id="data-proximo-contato"
            type="date"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={emAndamento}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={emAndamento || data.trim() === ""}
            onClick={() => aoConfirmar(data)}
          >
            Marcar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
