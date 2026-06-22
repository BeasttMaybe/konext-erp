"use client";

import { useForm, Controller, type FieldValues } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  formContaAReceberSchema,
  FormContaAReceber,
  clientesMock,
  opçõesFormaRecebimento,
  opçõesOrigemReceita,
} from "@/lib/validations/financeiro";
import { Calendar, Loader2 } from "lucide-react";

interface PropsModalNovoRecebimento {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dados: FormContaAReceber) => void;
  carregando?: boolean;
}

type FormContaAReceberUI = {
  } & z.input<typeof formContaAReceberSchema>;

export function ModalNovoRecebimento({
  aberto,
  aoFechar,
  aoSalvar,
  carregando = false,
}: PropsModalNovoRecebimento) {
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<FormContaAReceberUI>({
    resolver: zodResolver(formContaAReceberSchema) as unknown as Resolver<FormContaAReceberUI>,
    defaultValues: {
      descricao: "",
      clienteId: "",
      valor: 0,
      dataVencimento: "",
      dataCompetencia: "",
      formaRecebimento: "PIX",
      origemDaReceita: "VENDA_PDV",
      notaFiscalEmitida: false,
      jurosCobrados: 0,
      descontoConcedido: 0,
      isParcelado: false,
      quantidadeParcelas: 2,
      observacoes: "",
    },
  });

  const isParcelado = watch("isParcelado");
  const quantidadeParcelas = Number(watch("quantidadeParcelas") || 0);
  const valorRecebimento = Number(watch("valor") || 0);

  const handleAoFechar = () => {
    reset();
    aoFechar();
  };

  const aoSubmeter = (dados: FieldValues) => {
    const dadosValidados = formContaAReceberSchema.parse(dados) as FormContaAReceber;
    aoSalvar(dadosValidados);
    reset();
  };

  // Formatar moeda
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  return (
    <Dialog open={aberto} onOpenChange={(novoEstado) => {
      if (!novoEstado) {
        handleAoFechar();
      }
    }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Registrar Novo Recebimento</DialogTitle>
          <DialogDescription>
            Preencha os dados do recebimento. Os campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(aoSubmeter)}>
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados do Recebimento</TabsTrigger>
              <TabsTrigger value="origem">Origem & Fiscal</TabsTrigger>
              <TabsTrigger value="acrescimos">Acréscimos & Observações</TabsTrigger>
            </TabsList>

            {/* TAB 1: Dados do Recebimento */}
            <TabsContent value="dados" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Descrição */}
                <div className="col-span-2">
                  <Label htmlFor="descricao" className="text-base font-semibold">
                    Descrição <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="descricao"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Input
                          id="descricao"
                          placeholder="Ex: Fatura #123 - Serviços de Manutenção"
                          {...field}
                          className={errors.descricao ? "border-red-500" : ""}
                        />
                        {errors.descricao?.message && (
                          <p className="text-sm text-red-500 mt-1">
                            {String(errors.descricao.message)}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                {/* Cliente/Órgão */}
                <div>
                  <Label htmlFor="clienteId" className="text-base font-semibold">
                    Cliente/Órgão Público <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="clienteId"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            className={errors.clienteId ? "border-red-500" : ""}
                          >
                            <SelectValue placeholder="Selecione um cliente..." />
                          </SelectTrigger>
                          <SelectContent>
                            {clientesMock.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id}>
                                {cliente.nome} ({cliente.tipo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.clienteId?.message && (
                          <p className="text-sm text-red-500 mt-1">
                            {String(errors.clienteId.message)}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                {/* Valor */}
                <div>
                  <Label htmlFor="valor" className="text-base font-semibold">
                    Valor <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="valor"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Input
                          id="valor"
                          type="number"
                          placeholder="0,00"
                          step="0.01"
                          min="0"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={Number(field.value ?? 0)}
                          onChange={(evento) => field.onChange(evento.target.value)}
                          className={errors.valor ? "border-red-500" : ""}
                        />
                        {errors.valor?.message && (
                          <p className="text-sm text-red-500 mt-1">
                            {String(errors.valor.message)}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                {/* Data de Vencimento */}
                <div>
                  <Label
                    htmlFor="dataVencimento"
                    className="text-base font-semibold"
                  >
                    Data de Vencimento <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="dataVencimento"
                    control={control}
                    render={({ field }) => (
                      <>
                        <div className="relative">
                          <Input
                            id="dataVencimento"
                            type="date"
                            {...field}
                            value={String(field.value ?? "")}
                            onChange={(e) => field.onChange(e.target.value)}
                            className={`pr-10 ${
                              errors.dataVencimento ? "border-red-500" : ""
                            }`}
                          />
                          <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                        {errors.dataVencimento?.message && (
                          <p className="text-sm text-red-500 mt-1">
                            {String(errors.dataVencimento.message)}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                {/* Forma de Recebimento */}
                <div>
                  <Label
                    htmlFor="formaRecebimento"
                    className="text-base font-semibold"
                  >
                    Forma de Recebimento <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="formaRecebimento"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            className={
                              errors.formaRecebimento ? "border-red-500" : ""
                            }
                          >
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {opçõesFormaRecebimento.map((opcao) => (
                              <SelectItem key={opcao.valor} value={opcao.valor}>
                                {opcao.rótulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.formaRecebimento?.message && (
                          <p className="text-sm text-red-500 mt-1">
                            {String(errors.formaRecebimento.message)}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                {/* Data de Competência (Opcional) */}
                <div>
                  <Label
                    htmlFor="dataCompetencia"
                    className="text-base font-semibold"
                  >
                    Data de Competência
                  </Label>
                  <Controller
                    name="dataCompetencia"
                    control={control}
                    render={({ field }) => (
                      <div className="relative">
                        <Input
                          id="dataCompetencia"
                          type="date"
                          {...field}
                          value={String(field.value ?? "")}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="pr-10"
                        />
                        <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Para contratos B2B mensais
                  </p>
                </div>

                {/* Parcelamento */}
                <div className="col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900 space-y-3">
                  <div className="flex items-center space-x-3">
                    <Controller
                      name="isParcelado"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="isParcelado"
                          checked={Boolean(field.value)}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                        />
                      )}
                    />
                    <Label htmlFor="isParcelado" className="text-sm font-medium cursor-pointer">
                      Recebimento parcelado
                    </Label>
                  </div>

                  {isParcelado && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="quantidadeParcelas" className="text-sm font-semibold">
                          Quantidade de parcelas <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                          name="quantidadeParcelas"
                          control={control}
                          render={({ field }) => (
                            <Input
                              id="quantidadeParcelas"
                              type="number"
                              min={2}
                              max={24}
                              step={1}
                              {...field}
                              value={String(field.value ?? "")}
                              onChange={(e) => field.onChange(Number(e.target.value) || "")}
                              className={errors.quantidadeParcelas ? "border-red-500" : ""}
                            />
                          )}
                        />
                        {errors.quantidadeParcelas?.message && (
                          <p className="text-sm text-red-500 mt-1">
                            {String(errors.quantidadeParcelas.message)}
                          </p>
                        )}
                      </div>

                      <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 flex flex-col justify-center">
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                          Valor por parcela
                        </span>
                        <span className="text-base font-bold text-emerald-800 dark:text-emerald-200">
                          {quantidadeParcelas >= 2
                            ? formatarMoeda(valorRecebimento / quantidadeParcelas)
                            : formatarMoeda(0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Origem & Fiscal */}
            <TabsContent value="origem" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4">
                {/* Origem da Receita */}
                <div>
                  <Label
                    htmlFor="origemDaReceita"
                    className="text-base font-semibold"
                  >
                    Origem da Receita <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="origemDaReceita"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            className={
                              errors.origemDaReceita ? "border-red-500" : ""
                            }
                          >
                            <SelectValue placeholder="Selecione a origem..." />
                          </SelectTrigger>
                          <SelectContent>
                            {opçõesOrigemReceita.map((opcao) => (
                              <SelectItem key={opcao.valor} value={opcao.valor}>
                                {opcao.rótulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.origemDaReceita?.message && (
                          <p className="text-sm text-red-500 mt-1">
                            {String(errors.origemDaReceita.message)}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                {/* Documento de Origem */}
                <div>
                  <Label
                    htmlFor="documentoOrigemId"
                    className="text-base font-semibold"
                  >
                    Documento de Origem
                  </Label>
                  <Controller
                    name="documentoOrigemId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="documentoOrigemId"
                        placeholder="Ex: OS #1024 ou Empenho #2024/55"
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ID da Ordem de Serviço ou Número do Empenho
                  </p>
                </div>

                {/* Nota Fiscal Emitida */}
                <div className="flex items-center space-x-3 p-3 border rounded-lg bg-slate-50 dark:bg-slate-900">
                  <Controller
                    name="notaFiscalEmitida"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="notaFiscalEmitida"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label
                    htmlFor="notaFiscalEmitida"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Nota Fiscal Emitida?
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Acréscimos & Observações */}
            <TabsContent value="acrescimos" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Juros Cobrados */}
                <div>
                  <Label htmlFor="jurosCobrados" className="text-base font-semibold">
                    Juros Cobrados
                  </Label>
                  <Controller
                    name="jurosCobrados"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="jurosCobrados"
                        type="number"
                        placeholder="0,00"
                        step="0.01"
                        min="0"
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Em R$</p>
                </div>

                {/* Desconto Concedido */}
                <div>
                  <Label
                    htmlFor="descontoConcedido"
                    className="text-base font-semibold"
                  >
                    Desconto Concedido
                  </Label>
                  <Controller
                    name="descontoConcedido"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="descontoConcedido"
                        type="number"
                        placeholder="0,00"
                        step="0.01"
                        min="0"
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Em R$</p>
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label htmlFor="observacoes" className="text-base font-semibold">
                  Observações
                </Label>
                <Controller
                  name="observacoes"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      id="observacoes"
                      placeholder="Informações adicionais, notas internas..."
                      {...field}
                      value={field.value || ""}
                      rows={3}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  )}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <DialogFooter className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleAoFechar}
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={carregando}
            >
              {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Recebimento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
