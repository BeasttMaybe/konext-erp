"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TipoPeca } from "@prisma/client";
import { toast } from "sonner";
import { adicionarItemOS } from "@/app/actions/os-itens";
import { calcularPrecoVendaPeca } from "@/lib/utils/precificacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [isPending, startTransition] = useTransition();

  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("TELA");
  const [descricao, setDescricao] = useState("");
  const [custoPeca, setCustoPeca] = useState<string>("");
  const [valorManual, setValorManual] = useState<string>("");

  const custoPecaNumero = Number(custoPeca || 0);
  const valorManualNumero = Number(valorManual || 0);

  const valorPreview = useMemo(() => {
    if (tipoPeca === "OUTROS") return valorManualNumero;
    if (!Number.isFinite(custoPecaNumero) || custoPecaNumero <= 0) return 0;

    try {
      return calcularPrecoVendaPeca(tipoPeca, custoPecaNumero);
    } catch {
      return 0;
    }
  }, [tipoPeca, custoPecaNumero, valorManualNumero]);

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

    startTransition(async () => {
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

  return (
    <div className="space-y-6">
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Adicionar Peca/Servico
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            OS #{numeroOs} - Motor de precificacao aplicado automaticamente.
          </p>
        </div>

        <form onSubmit={aoSubmeter} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="tipo-peca">Tipo da Peca</Label>
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

          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="descricao-item">Descricao</Label>
            <Input
              id="descricao-item"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder="Ex: Troca de tela OLED"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custo-peca">Custo da Peca (R$)</Label>
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

          {tipoPeca === "OUTROS" && (
            <div className="space-y-2">
              <Label htmlFor="valor-manual">Valor Manual (R$)</Label>
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
          )}

          <div className="flex items-center gap-3 xl:col-span-5">
            <Button type="submit" disabled={isPending || desabilitarCadastro}>
              {isPending ? "Adicionando..." : "Adicionar Item"}
            </Button>
            <Badge variant="secondary" className="text-sm">
              Valor para o Cliente: {formatarMoeda(valorPreview)}
            </Badge>
          </div>

          {desabilitarCadastro && (
            <p className="xl:col-span-5 text-xs text-amber-600 dark:text-amber-400">
              Cadastro de itens indisponivel nesta OS porque ela nao foi carregada do banco de dados.
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
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
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end">
          <p className="text-lg font-bold text-emerald-600">Total da OS: {formatarMoeda(totalOS)}</p>
        </div>
      </Card>
    </div>
  );
}
