"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TipoPeca } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ItemOSTabela = {
  id: string;
  descricao: string;
  tipoPeca: TipoPeca;
  custoPeca: number;
  valorCobrado: number;
  criadoEm: string;
};

type PropsSecaoItensOS = {
  osId: string;
  numeroOs: number;
  itens: ItemOSTabela[];
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
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

export function SecaoItensOS({ osId, numeroOs, itens, desabilitarCadastro = false }: PropsSecaoItensOS) {
  const router = useRouter();
  const [isPendingAdicionar, startTransitionAdicionar] = useTransition();
  const [isPendingEditar, startTransitionEditar] = useTransition();
  const [isPendingRemover, startTransitionRemover] = useTransition();

  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("TELA");
  const [descricao, setDescricao] = useState("");
  const [custoPeca, setCustoPeca] = useState<string>("");
  const [valorManual, setValorManual] = useState<string>("");

  const [itemEmEdicao, setItemEmEdicao] = useState<ItemOSTabela | null>(null);
  const [itemParaRemover, setItemParaRemover] = useState<ItemOSTabela | null>(null);
  const [tipoPecaEdicao, setTipoPecaEdicao] = useState<TipoPeca>("TELA");
  const [descricaoEdicao, setDescricaoEdicao] = useState("");
  const [custoPecaEdicao, setCustoPecaEdicao] = useState<string>("");
  const [valorCobradoEdicao, setValorCobradoEdicao] = useState<string>("");

  const custoPecaNumero = Number(custoPeca || 0);
  const valorManualNumero = Number(valorManual || 0);

  // O valor cobrado ao cliente é sempre o valor manual informado — sem cálculo automático de markup.
  const valorPreview = valorManualNumero;

  const totalOS = useMemo(() => {
    return itens.reduce((total, item) => total + item.valorCobrado, 0);
  }, [itens]);

  const limparFormulario = () => {
    setDescricao("");
    setCustoPeca("");
    setValorManual("");
    setTipoPeca("TELA");
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

    startTransitionAdicionar(async () => {
      try {
        await adicionarItemOS(osId, {
          tipoPeca,
          descricao,
          custoPeca: custoPecaNumero,
          valorManual: valorManualNumero,
        });

        toast.success("Item adicionado com sucesso na ordem de servico.");
        limparFormulario();
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

    startTransitionEditar(async () => {
      const resultado = await atualizarItemOS({
        itemId: itemEmEdicao.id,
        osId,
        tipoPeca: tipoPecaEdicao,
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
    <div className="space-y-6">
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Adicionar Peca/Servico
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            OS #{numeroOs} — Informe o valor cobrado ao cliente manualmente.
          </p>
        </div>

        <form onSubmit={aoSubmeter} className="mt-4 space-y-0">

          {/* Grade de campos — 12 colunas para distribuição precisa */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

            {/* Tipo da Peça — 3 colunas */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <Label htmlFor="tipo-peca" className="text-sm text-slate-600 dark:text-slate-400">
                Tipo da Peça
              </Label>
              <Select value={tipoPeca} onValueChange={(valor) => setTipoPeca(valor as TipoPeca)}>
                <SelectTrigger id="tipo-peca" className="h-10">
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

            {/* Descrição — 5 colunas */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <Label htmlFor="descricao-item" className="text-sm text-slate-600 dark:text-slate-400">
                Descrição
              </Label>
              <Input
                id="descricao-item"
                className="h-10"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Ex: Troca de tela OLED"
              />
            </div>

            {/* Custo da Peça — 2 colunas */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="custo-peca" className="text-sm text-slate-600 dark:text-slate-400">
                Custo (R$)
              </Label>
              <Input
                id="custo-peca"
                className="h-10"
                type="number"
                min="0"
                step="0.01"
                value={custoPeca}
                onChange={(evento) => setCustoPeca(evento.target.value)}
                placeholder="0,00"
              />
            </div>

            {/* Valor Cobrado ao Cliente — 2 colunas */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="valor-manual" className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Cobrado (R$)
              </Label>
              <Input
                id="valor-manual"
                className="h-10"
                type="number"
                min="0"
                step="0.01"
                value={valorManual}
                onChange={(evento) => setValorManual(evento.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Linha de ação — separada visualmente do grid de campos */}
          <div className="flex items-center gap-6 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700/50">
            <Button type="submit" disabled={isPendingAdicionar || desabilitarCadastro}>
              {isPendingAdicionar ? "Adicionando..." : "Adicionar Item"}
            </Button>
            <Badge variant="secondary" className="text-sm">
              Valor para o Cliente: {formatarMoeda(valorPreview)}
            </Badge>
          </div>

          {/* Aviso quando OS está em modo visualização */}
          {desabilitarCadastro && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Cadastro de itens indisponível nesta OS porque ela não foi carregada do banco de dados.
            </p>
          )}
        </form>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-0">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Itens da Ordem de Servico</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descricao</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Valor Cobrado</TableHead>
              <TableHead className="text-right">Criado em</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                  Nenhum item adicionado nesta OS.
                </TableCell>
              </TableRow>
            )}

            {itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.descricao}</TableCell>
                <TableCell>{item.tipoPeca.replaceAll("_", " ")}</TableCell>
                <TableCell className="text-right">{formatarMoeda(item.custoPeca)}</TableCell>
                <TableCell className="text-right font-semibold">{formatarMoeda(item.valorCobrado)}</TableCell>
                <TableCell className="text-right text-slate-500">
                  {new Date(item.criadoEm).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => abrirEdicao(item)}
                      disabled={desabilitarCadastro || isPendingEditar || isPendingRemover}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8"
                      onClick={() => setItemParaRemover(item)}
                      disabled={desabilitarCadastro || isPendingEditar || isPendingRemover}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remover
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end">
          <p className="text-lg font-bold text-emerald-600">Total da OS: {formatarMoeda(totalOS)}</p>
        </div>
      </Card>

      <Dialog open={Boolean(itemEmEdicao)} onOpenChange={(aberto) => !aberto && setItemEmEdicao(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar item da OS</DialogTitle>
            <DialogDescription>
              Atualize tipo, descricao, custo e valor cobrado ao cliente.
            </DialogDescription>
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
