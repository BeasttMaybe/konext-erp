"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categoriasProduto,
  formProdutoSchema,
  type FormProduto,
} from "@/lib/validations/estoque";
import { deDecimal, subtrair } from "@/lib/dinheiro";

interface PropsModalNovoProduto {
  aberto: boolean;
  aoFechar: () => void;
  produtoInicial?: (FormProduto & { id: string }) | null;
  aoSalvar: (dados: FormProduto) => Promise<{ sucesso: boolean; mensagem: string }>;
}

const valoresPadrao: FormProduto = {
  nome: "",
  codigoBarras: "",
  imagemUrl: "",
  descricao: "",
  categoria: "ACESSORIO",
  custo: 0,
  precoVenda: 0,
  quantidadeEstoque: 0,
  estoqueMinimo: 3,
};

const mapaCategoriaRotulo: Record<(typeof categoriasProduto)[number], string> = {
  ACESSORIO: "Acessorio",
  PECA_REPARO: "Peca de Reparo",
  EQUIPAMENTO_REDE: "Equipamento de Rede",
  SERVICO: "Servico",
  OUTROS: "Outros",
};

export function ModalNovoProduto({
  aberto,
  aoFechar,
  produtoInicial = null,
  aoSalvar,
}: PropsModalNovoProduto) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormProduto>({
    resolver: zodResolver(formProdutoSchema) as unknown as Resolver<FormProduto>,
    defaultValues: valoresPadrao,
  });

  const custo = useWatch({ control, name: "custo" }) ?? 0;
  const precoVenda = useWatch({ control, name: "precoVenda" }) ?? 0;

  const margemBruta = useMemo(() => {
    if (precoVenda <= 0) return 0;

    // Fase 2A-3: a subtracao sai do float. `19.90 - 12.30` em ponto
    // flutuante da 7.600000000000001; em centavo da 760, e a margem que a
    // tela mostra passa a ser a mesma que o relatorio de lucro vai calcular
    // depois sobre os mesmos dois numeros.
    const precoVendaCentavos = deDecimal(precoVenda);
    const lucroCentavos = subtrair(precoVendaCentavos, deDecimal(custo));

    return (lucroCentavos / precoVendaCentavos) * 100;
  }, [custo, precoVenda]);

  useEffect(() => {
    if (!aberto) return;

    if (produtoInicial) {
      reset({
        nome: produtoInicial.nome,
        codigoBarras: produtoInicial.codigoBarras || "",
        imagemUrl: produtoInicial.imagemUrl || "",
        descricao: produtoInicial.descricao || "",
        categoria: produtoInicial.categoria,
        custo: produtoInicial.custo,
        precoVenda: produtoInicial.precoVenda,
        quantidadeEstoque: produtoInicial.quantidadeEstoque,
        estoqueMinimo: produtoInicial.estoqueMinimo,
      });
      return;
    }

    reset(valoresPadrao);
  }, [aberto, produtoInicial, reset]);

  const aoCancelar = () => {
    reset(valoresPadrao);
    aoFechar();
  };

  const aoSubmeter = async (dados: FormProduto) => {
    const resultado = await aoSalvar(dados);
    if (!resultado.sucesso) return;

    reset(valoresPadrao);
    aoFechar();
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado) aoCancelar();
      }}
    >
      <DialogContent className="max-w-3xl bg-background border-border">
        <DialogHeader>
          <DialogTitle>{produtoInicial ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            {produtoInicial
              ? "Atualize os dados do produto selecionado."
              : "Cadastre produtos de estoque e servicos para venda no PDV."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="nome">Nome do Produto</Label>
              <Controller
                name="nome"
                control={control}
                render={({ field }) => (
                  <Input
                    id="nome"
                    {...field}
                    className={errors.nome ? "border-destructive" : ""}
                  />
                )}
              />
              {errors.nome?.message && (
                <p className="text-xs text-destructive">{errors.nome.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigoBarras">Codigo de Barras</Label>
              <Controller
                name="codigoBarras"
                control={control}
                render={({ field }) => (
                  <Input id="codigoBarras" {...field} value={field.value || ""} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imagemUrl">URL da Imagem</Label>
              <Controller
                name="imagemUrl"
                control={control}
                render={({ field }) => (
                  <Input
                    id="imagemUrl"
                    placeholder="https://exemplo.com/imagem.jpg"
                    {...field}
                    value={field.value || ""}
                    className={errors.imagemUrl ? "border-destructive" : ""}
                  />
                )}
              />
              {errors.imagemUrl?.message && (
                <p className="text-xs text-destructive">{errors.imagemUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Controller
                name="categoria"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasProduto.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {mapaCategoriaRotulo[categoria]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custo">Custo (R$)</Label>
              <Controller
                name="custo"
                control={control}
                render={({ field }) => (
                  <Input
                    id="custo"
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.value || ""}
                    onChange={(evento) => field.onChange(Number(evento.target.value) || 0)}
                    className={errors.custo ? "border-destructive" : ""}
                  />
                )}
              />
              {errors.custo?.message && (
                <p className="text-xs text-destructive">{errors.custo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="precoVenda">Preco de Venda (R$)</Label>
              <Controller
                name="precoVenda"
                control={control}
                render={({ field }) => (
                  <Input
                    id="precoVenda"
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.value || ""}
                    onChange={(evento) => field.onChange(Number(evento.target.value) || 0)}
                    className={errors.precoVenda ? "border-destructive" : ""}
                  />
                )}
              />
              {errors.precoVenda?.message && (
                <p className="text-xs text-destructive">{errors.precoVenda.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidadeEstoque">Quantidade em Estoque</Label>
              <Controller
                name="quantidadeEstoque"
                control={control}
                render={({ field }) => (
                  <Input
                    id="quantidadeEstoque"
                    type="number"
                    min={0}
                    step="1"
                    value={field.value || ""}
                    onChange={(evento) =>
                      field.onChange(Math.floor(Number(evento.target.value) || 0))
                    }
                    className={errors.quantidadeEstoque ? "border-destructive" : ""}
                  />
                )}
              />
              {errors.quantidadeEstoque?.message && (
                <p className="text-xs text-destructive">{errors.quantidadeEstoque.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estoqueMinimo">Estoque Minimo</Label>
              <Controller
                name="estoqueMinimo"
                control={control}
                render={({ field }) => (
                  <Input
                    id="estoqueMinimo"
                    type="number"
                    min={0}
                    step="1"
                    value={field.value || ""}
                    onChange={(evento) =>
                      field.onChange(Math.floor(Number(evento.target.value) || 0))
                    }
                    className={errors.estoqueMinimo ? "border-destructive" : ""}
                  />
                )}
              />
              {errors.estoqueMinimo?.message && (
                <p className="text-xs text-destructive">{errors.estoqueMinimo.message}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Controller
                name="descricao"
                control={control}
                render={({ field }) => (
                  <Textarea id="descricao" rows={4} {...field} value={field.value || ""} />
                )}
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              Calculo de Margem Bruta: 
              <span
                className={`ml-1 font-semibold ${
                  margemBruta < 0 ? "text-destructive" : "text-emerald-600"
                }`}
              >
                Margem: {margemBruta.toFixed(1)}%
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoCancelar} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {produtoInicial ? "Salvar Alteracoes" : "Salvar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
