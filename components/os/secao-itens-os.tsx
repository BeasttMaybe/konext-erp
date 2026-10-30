"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TipoPeca } from "@prisma/client";
import { exigeMarcaPeca, validarMarcaDoItem } from "@/lib/dominio/os/marcas-peca";
import { CampoMarcaPeca, type MarcaDisponivel } from "./campo-marca-peca";
import { MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { adicionarItemOS, atualizarItemOS, removerItemOS } from "@/app/actions/os-itens";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ItemOSTabela = {
  id: string;
  descricao: string;
  tipoPeca: TipoPeca;
  /** null quando o usuário logado não tem a permissão os.ver_custos. */
  custoPeca: number | null;
  valorCobrado: number;
  /** null em itens lançados antes do cadastro de marcas existir. */
  marcaPecaId: string | null;
  marcaPecaNome: string | null;
  criadoEm: string;
};

type PropsSecaoItensOS = {
  osId: string;
  numeroOs: number;
  itens: ItemOSTabela[];
  /** Só as marcas ativas — a do item em edição entra à parte, no próprio campo. */
  marcasDisponiveis: MarcaDisponivel[];
  desabilitarCadastro?: boolean;
};

const opcoesTipoPeca: Array<{ value: TipoPeca; label: string }> = [
  { value: "TELA", label: "Tela" },
  { value: "BATERIA", label: "Bateria" },
  { value: "CONECTOR_CARGA", label: "Conector de Carga" },
  { value: "TAMPA_IPHONE", label: "Tampa iPhone" },
  { value: "TAMPA_ANDROID", label: "Tampa Android" },
  { value: "OUTROS", label: "Outros" },
];

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const COLUNAS_GRID = "grid-cols-[minmax(0,1.6fr)_100px_100px_100px_40px]";

export function SecaoItensOS({
  osId,
  numeroOs,
  itens,
  marcasDisponiveis,
  desabilitarCadastro = false,
}: PropsSecaoItensOS) {
  const router = useRouter();
  const [isPendingAdicionar, startTransitionAdicionar] = useTransition();
  const [isPendingEditar, startTransitionEditar] = useTransition();
  const [isPendingRemover, startTransitionRemover] = useTransition();

  const [dialogoAdicionarAberto, setDialogoAdicionarAberto] = useState(false);
  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("TELA");
  const [descricao, setDescricao] = useState("");
  const [custoPeca, setCustoPeca] = useState<string>("");
  const [valorManual, setValorManual] = useState<string>("");
  const [marcaPecaId, setMarcaPecaId] = useState<string | null>(null);

  const [itemEmEdicao, setItemEmEdicao] = useState<ItemOSTabela | null>(null);
  const [itemParaRemover, setItemParaRemover] = useState<ItemOSTabela | null>(null);
  const [tipoPecaEdicao, setTipoPecaEdicao] = useState<TipoPeca>("TELA");
  const [descricaoEdicao, setDescricaoEdicao] = useState("");
  const [custoPecaEdicao, setCustoPecaEdicao] = useState<string>("");
  const [valorCobradoEdicao, setValorCobradoEdicao] = useState<string>("");
  const [marcaPecaIdEdicao, setMarcaPecaIdEdicao] = useState<string | null>(null);

  const custoPecaNumero = Number(custoPeca || 0);
  const valorManualNumero = Number(valorManual || 0);

  const totalOS = useMemo(() => itens.reduce((total, item) => total + item.valorCobrado, 0), [itens]);
  const mostraCusto = itens.length === 0 || itens.some((item) => item.custoPeca !== null);

  const limparFormulario = () => {
    setDescricao("");
    setCustoPeca("");
    setValorManual("");
    setTipoPeca("TELA");
    setMarcaPecaId(null);
  };

  const aoSubmeter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (desabilitarCadastro) {
      toast.error("Esta OS esta em modo visualizacao. Cadastre a OS no banco para adicionar itens.");
      return;
    }

    if (!descricao.trim()) {
      toast.error("Informe a descricao da peca ou servico.");
      return;
    }

    if (!Number.isFinite(custoPecaNumero) || custoPecaNumero < 0) {
      toast.error("Informe um custo valido para a peca.");
      return;
    }

    if (tipoPeca === "OUTROS" && (!Number.isFinite(valorManualNumero) || valorManualNumero <= 0)) {
      toast.error("Informe o valor manual para itens do tipo OUTROS.");
      return;
    }

    if (tipoPeca !== "OUTROS" && (!Number.isFinite(valorManualNumero) || valorManualNumero <= 0)) {
      toast.error("Informe o valor cobrado ao cliente.");
      return;
    }

    const marcaValida = validarMarcaDoItem(tipoPeca, marcaPecaId);
    if (!marcaValida.valido) {
      toast.error(marcaValida.erro);
      return;
    }

    startTransitionAdicionar(async () => {
      try {
        await adicionarItemOS(osId, {
          tipoPeca,
          descricao,
          custoPeca: custoPecaNumero,
          valorManual: valorManualNumero,
          marcaPecaId,
        });

        toast.success("Item adicionado com sucesso na ordem de servico.");
        limparFormulario();
        setDialogoAdicionarAberto(false);
        router.refresh();
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Erro ao adicionar item na ordem de servico.";
        toast.error(mensagem);
      }
    });
  };

  const abrirEdicao = (item: ItemOSTabela) => {
    setItemEmEdicao(item);
    setTipoPecaEdicao(item.tipoPeca);
    setDescricaoEdicao(item.descricao);
    setCustoPecaEdicao(String(item.custoPeca));
    setValorCobradoEdicao(String(item.valorCobrado));
    setMarcaPecaIdEdicao(item.marcaPecaId);
  };

  const aoSalvarEdicao = () => {
    if (!itemEmEdicao) return;

    const custoNormalizado = Number(custoPecaEdicao || 0);
    const valorCobradoNormalizado = Number(valorCobradoEdicao || 0);

    if (!descricaoEdicao.trim()) {
      toast.error("Informe a descricao da peca ou servico.");
      return;
    }

    if (!Number.isFinite(custoNormalizado) || custoNormalizado < 0) {
      toast.error("Informe um custo valido para a peca.");
      return;
    }

    if (!Number.isFinite(valorCobradoNormalizado) || valorCobradoNormalizado <= 0) {
      toast.error("Informe um valor cobrado valido ao cliente.");
      return;
    }

    const marcaValidaEdicao = validarMarcaDoItem(tipoPecaEdicao, marcaPecaIdEdicao);
    if (!marcaValidaEdicao.valido) {
      toast.error(marcaValidaEdicao.erro);
      return;
    }

    startTransitionEditar(async () => {
      const resultado = await atualizarItemOS({
        itemId: itemEmEdicao.id,
        osId,
        tipoPeca: tipoPecaEdicao,
        marcaPecaId: marcaPecaIdEdicao,
        descricao: descricaoEdicao,
        custoPeca: custoNormalizado,
        valorCobrado: valorCobradoNormalizado,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(resultado.mensagem);
      setItemEmEdicao(null);
      router.refresh();
    });
  };

  const confirmarRemocao = () => {
    if (!itemParaRemover) return;

    startTransitionRemover(async () => {
      const resultado = await removerItemOS({
        itemId: itemParaRemover.id,
        osId,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(resultado.mensagem);
      setItemParaRemover(null);
      router.refresh();
    });
  };

  return (
    <div className="p-kx-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-bold text-kx-texto">Peças e serviços</span>
        <Button
          type="button"
          size="sm"
          className="ml-auto h-[34px] text-xs"
          onClick={() => setDialogoAdicionarAberto(true)}
          disabled={desabilitarCadastro}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar
        </Button>
      </div>

      <div className={`grid ${COLUNAS_GRID} gap-2.5 px-2.5 text-xs font-semibold text-kx-legenda`}>
        <span>Descrição</span>
        <span>Tipo</span>
        {mostraCusto && <span className="text-right">Custo</span>}
        <span className="text-right">Cobrado</span>
        <span />
      </div>

      <div className="rounded-kx-cartao">
        {itens.length === 0 ? (
          <p className="py-8 text-center text-sm text-kx-legenda">Nenhum item adicionado nesta OS.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {itens.map((item) => (
              <div
                key={item.id}
                className={`grid ${COLUNAS_GRID} items-center gap-2.5 rounded-kx-cartao bg-kx-cartao px-2.5 py-2.5 text-sm`}
              >
                <span className="truncate font-medium text-kx-texto">{item.descricao}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="w-fit truncate rounded-kx-pilula bg-kx-superficie px-2.5 py-0.5 text-xs font-bold text-kx-texto-2">
                    {item.tipoPeca.replaceAll("_", " ")}
                  </span>
                  {item.marcaPecaNome ? (
                    <span className="truncate pl-0.5 text-[11px] text-kx-legenda">{item.marcaPecaNome}</span>
                  ) : null}
                </div>
                {mostraCusto && (
                  <span className="text-right tabular-nums text-kx-erro-icone">
                    {item.custoPeca === null ? "—" : formatarMoeda(item.custoPeca)}
                  </span>
                )}
                <span className="text-right font-bold tabular-nums text-kx-texto">{formatarMoeda(item.valorCobrado)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-kx-botao text-kx-legenda hover:bg-kx-superficie hover:text-kx-texto"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Ações do item</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.custoPeca !== null && (
                      <DropdownMenuItem
                        onClick={() => abrirEdicao(item)}
                        disabled={desabilitarCadastro || isPendingEditar || isPendingRemover}
                      >
                        Editar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setItemParaRemover(item)}
                      disabled={desabilitarCadastro || isPendingEditar || isPendingRemover}
                      className="text-destructive focus:text-destructive"
                    >
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-kx-painel-borda px-2.5 pt-2.5">
        <span className="text-xs text-kx-legenda">{itens.length === 1 ? "1 item" : `${itens.length} itens`}</span>
        <span className="text-base font-extrabold tabular-nums text-kx-texto">Total: {formatarMoeda(totalOS)}</span>
      </div>

      <Dialog open={dialogoAdicionarAberto} onOpenChange={setDialogoAdicionarAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar peça/serviço</DialogTitle>
            <DialogDescription>OS #{numeroOs} — informe o valor cobrado ao cliente manualmente.</DialogDescription>
          </DialogHeader>

          <form onSubmit={aoSubmeter} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tipo-peca">Tipo da Peça</Label>
              <Select value={tipoPeca} onValueChange={(valor) => setTipoPeca(valor as TipoPeca)}>
                <SelectTrigger id="tipo-peca">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesTipoPeca.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CampoMarcaPeca
              idCampo="marca-peca-item"
              marcas={marcasDisponiveis}
              valor={marcaPecaId}
              onChange={setMarcaPecaId}
              exigida={exigeMarcaPeca(tipoPeca)}
              desabilitado={isPendingAdicionar}
            />

            <div className="space-y-2">
              <Label htmlFor="descricao-item">Descrição</Label>
              <Input
                id="descricao-item"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Ex: Troca de tela OLED"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custo-peca">Custo (R$)</Label>
                <Input
                  id="custo-peca"
                  type="number"
                  min="0"
                  step="0.01"
                  value={custoPeca}
                  onChange={(evento) => setCustoPeca(evento.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor-manual">Cobrado (R$)</Label>
                <Input
                  id="valor-manual"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorManual}
                  onChange={(evento) => setValorManual(evento.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogoAdicionarAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPendingAdicionar}>
                {isPendingAdicionar ? "Adicionando..." : "Adicionar Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(itemEmEdicao)} onOpenChange={(aberto) => !aberto && setItemEmEdicao(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar item da OS</DialogTitle>
            <DialogDescription>Atualize tipo, descricao, custo e valor cobrado ao cliente.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo-peca-edicao">Tipo da Peça</Label>
              <Select value={tipoPecaEdicao} onValueChange={(valor) => setTipoPecaEdicao(valor as TipoPeca)}>
                <SelectTrigger id="tipo-peca-edicao">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesTipoPeca.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CampoMarcaPeca
              idCampo="marca-peca-item-edicao"
              marcas={marcasDisponiveis}
              valor={marcaPecaIdEdicao}
              onChange={setMarcaPecaIdEdicao}
              exigida={exigeMarcaPeca(tipoPecaEdicao)}
              desabilitado={isPendingEditar}
              marcaAtual={
                itemEmEdicao?.marcaPecaId && itemEmEdicao.marcaPecaNome
                  ? { id: itemEmEdicao.marcaPecaId, nome: itemEmEdicao.marcaPecaNome }
                  : null
              }
            />

            <div className="space-y-2">
              <Label htmlFor="descricao-edicao">Descricao</Label>
              <Input
                id="descricao-edicao"
                value={descricaoEdicao}
                onChange={(evento) => setDescricaoEdicao(evento.target.value)}
                placeholder="Ex: Troca de tela OLED"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custo-edicao">Custo (R$)</Label>
                <Input
                  id="custo-edicao"
                  type="number"
                  min="0"
                  step="0.01"
                  value={custoPecaEdicao}
                  onChange={(evento) => setCustoPecaEdicao(evento.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor-edicao">Cobrado (R$)</Label>
                <Input
                  id="valor-edicao"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorCobradoEdicao}
                  onChange={(evento) => setValorCobradoEdicao(evento.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemEmEdicao(null)} disabled={isPendingEditar}>
              Cancelar
            </Button>
            <Button onClick={aoSalvarEdicao} disabled={isPendingEditar}>
              {isPendingEditar ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(itemParaRemover)} onOpenChange={(aberto) => !aberto && setItemParaRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item da OS?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove apenas o item selecionado e atualiza o total da ordem de servico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPendingRemover}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPendingRemover}
              onClick={(evento) => {
                evento.preventDefault();
                confirmarRemocao();
              }}
            >
              {isPendingRemover ? "Removendo..." : "Confirmar remocao"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
