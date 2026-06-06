"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  schemaFormContaAPagar,
  FormContaAPagar,
  fornecedoresMock,
  planoContasMock,
  opçõesCentroCusto,
  opçõesFormaPagamento,
} from "@/lib/validations/financeiro";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Plus } from "lucide-react";

interface PropsModalNovaContaAPagar {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dados: FormContaAPagar) => void;
  carregando?: boolean;
}

/**
 * Modal de Nova Conta a Pagar - Versão Enterprise com 3 Abas
 * Integrado com validação Zod e React Hook Form
 */
export function ModalNovaContaAPagar({
  aberto,
  aoFechar,
  aoSalvar,
  carregando = false,
}: PropsModalNovaContaAPagar) {
  const [abaSelecionada, setAbaSelecionada] = useState("principal");
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);

  // Configuração do formulário
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schemaFormContaAPagar),
    defaultValues: {
      isParcelado: false,
      formaPagamento: "PIX",
      centroCusto: "ADMINISTRATIVO",
    },
  });

  // Watch para dependências
  const isParcelado = watch("isParcelado");
  const formaPagamento = watch("formaPagamento");

  /**
   * Submete o formulário
   */
  const aoSubmeter = (dados: FormContaAPagar) => {
    aoSalvar(dados);
    reset();
    setAbaSelecionada("principal");
    setArquivoSelecionado(null);
  };

  /**
   * Fecha o modal
   */
  const aoFecharLocal = () => {
    reset();
    setAbaSelecionada("principal");
    setArquivoSelecionado(null);
    aoFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={aoFecharLocal}>
      <DialogContent className="max-w-4xl">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
            Registrar Nova Conta a Pagar
          </DialogTitle>
          <DialogDescription className="text-zinc-600 dark:text-zinc-400">
            Preencha os detalhes da obrigação financeira. Todos os campos
            obrigatórios devem ser preenchidos.
          </DialogDescription>
        </DialogHeader>

        {/* Formulário com Abas */}
        <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-6">
          <Tabs
            value={abaSelecionada}
            onValueChange={setAbaSelecionada}
            className="space-y-4"
          >
            {/* Tabs Navigation */}
            <TabsList className="grid w-full grid-cols-3 bg-zinc-100 dark:bg-zinc-800">
              <TabsTrigger
                value="principal"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900"
              >
                Dados Principais
              </TabsTrigger>
              <TabsTrigger
                value="classificacao"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900"
              >
                Classificação & Rateio
              </TabsTrigger>
              <TabsTrigger
                value="anexos"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900"
              >
                Anexos & Juros
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Dados Principais */}
            <TabsContent value="principal" className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Descrição */}
                <div className="space-y-2">
                  <Label
                    htmlFor="descricao"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Descrição <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="descricao"
                    placeholder="ex: Aluguel do espaço comercial"
                    {...register("descricao")}
                    className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  {errors.descricao && (
                    <p className="text-xs text-red-500">
                      {errors.descricao.message}
                    </p>
                  )}
                </div>

                {/* Fornecedor */}
                <div className="space-y-2">
                  <Label
                    htmlFor="fornecedorId"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Fornecedor <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="fornecedorId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                          <SelectValue placeholder="Selecione um fornecedor" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-zinc-800">
                          {fornecedoresMock.map((forn) => (
                            <SelectItem
                              key={forn.id}
                              value={forn.id}
                              className="dark:text-white"
                            >
                              {forn.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.fornecedorId && (
                    <p className="text-xs text-red-500">
                      {errors.fornecedorId.message}
                    </p>
                  )}
                </div>

                {/* Valor */}
                <div className="space-y-2">
                  <Label
                    htmlFor="valor"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Valor (R$) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="valor"
                    type="number"
                    placeholder="0,00"
                    step="0.01"
                    {...register("valor")}
                    className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  {errors.valor && (
                    <p className="text-xs text-red-500">{errors.valor.message}</p>
                  )}
                </div>

                {/* Data de Vencimento */}
                <div className="space-y-2">
                  <Label
                    htmlFor="dataVencimento"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Data de Vencimento <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dataVencimento"
                    type="date"
                    {...register("dataVencimento", {
                      setValueAs: (value) => {
                        return value ? new Date(value) : undefined;
                      },
                    })}
                    className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  {errors.dataVencimento && (
                    <p className="text-xs text-red-500">
                      {errors.dataVencimento.message}
                    </p>
                  )}
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-2">
                  <Label
                    htmlFor="formaPagamento"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Forma de Pagamento <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="formaPagamento"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-zinc-800">
                          {opçõesFormaPagamento.map((opt) => (
                            <SelectItem
                              key={opt.valor}
                              value={opt.valor}
                              className="dark:text-white"
                            >
                              {opt.rótulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.formaPagamento && (
                    <p className="text-xs text-red-500">
                      {errors.formaPagamento.message}
                    </p>
                  )}
                </div>

                {/* Linha Digitável / Código de Barras (Condicional) */}
                {(formaPagamento === "BOLETO" || formaPagamento === "CARTAO") && (
                  <div className="col-span-2 space-y-2">
                    <Label
                      htmlFor="linhaDigitavel"
                      className="text-sm font-medium text-slate-900 dark:text-white"
                    >
                      Linha Digitável / Código de Barras
                    </Label>
                    <Input
                      id="linhaDigitavel"
                      placeholder="ex: 00000.00000 00000.000000 00000.000000 0 00000000000000"
                      {...register("linhaDigitavel")}
                      className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    {errors.linhaDigitavel && (
                      <p className="text-xs text-red-500">
                        {errors.linhaDigitavel.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: Classificação & Rateio */}
            <TabsContent value="classificacao" className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Plano de Contas */}
                <div className="space-y-2">
                  <Label
                    htmlFor="planoContaId"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Plano de Contas / Categoria{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="planoContaId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-zinc-800">
                          {planoContasMock.map((pc) => (
                            <SelectItem
                              key={pc.id}
                              value={pc.id}
                              className="dark:text-white"
                            >
                              {pc.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.planoContaId && (
                    <p className="text-xs text-red-500">
                      {errors.planoContaId.message}
                    </p>
                  )}
                </div>

                {/* Centro de Custo */}
                <div className="space-y-2">
                  <Label
                    htmlFor="centroCusto"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Centro de Custo <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="centroCusto"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-zinc-800">
                          {opçõesCentroCusto.map((opt) => (
                            <SelectItem
                              key={opt.valor}
                              value={opt.valor}
                              className="dark:text-white"
                            >
                              {opt.rótulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.centroCusto && (
                    <p className="text-xs text-red-500">
                      {errors.centroCusto.message}
                    </p>
                  )}
                </div>

                {/* Compra Parcelada */}
                <div className="col-span-2 space-y-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <div className="flex items-center space-x-2">
                    <Controller
                      name="isParcelado"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="isParcelado"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="dark:border-zinc-600"
                        />
                      )}
                    />
                    <Label
                      htmlFor="isParcelado"
                      className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
                    >
                      Compra Parcelada?
                    </Label>
                  </div>

                  {/* Quantidade de Parcelas */}
                  {isParcelado && (
                    <div className="space-y-2 ml-6 max-w-xs">
                      <Label
                        htmlFor="quantidadeParcelas"
                        className="text-sm font-medium text-slate-900 dark:text-white"
                      >
                        Quantidade de Parcelas{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="quantidadeParcelas"
                        type="number"
                        min="1"
                        max="120"
                        placeholder="ex: 12"
                        {...register("quantidadeParcelas")}
                        className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                      {errors.quantidadeParcelas && (
                        <p className="text-xs text-red-500">
                          {errors.quantidadeParcelas.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Anexos & Juros */}
            <TabsContent value="anexos" className="space-y-6">
              <div className="space-y-6">
                {/* Zona de Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-900 dark:text-white">
                    Anexar Documento (PDF, XML, etc.)
                  </Label>
                  <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Arraste um arquivo aqui ou{" "}
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        clique para selecionar
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                      Formatos aceitos: PDF, XML, PNG, JPG (máx. 5MB)
                    </p>
                    {arquivoSelecionado && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                        ✓ {arquivoSelecionado.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Multa e Juros */}
                <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="multaPrevista"
                      className="text-sm font-medium text-slate-900 dark:text-white"
                    >
                      Multa Prevista (R$)
                    </Label>
                    <Input
                      id="multaPrevista"
                      type="number"
                      placeholder="0,00"
                      step="0.01"
                      {...register("multaPrevista")}
                      className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    {errors.multaPrevista && (
                      <p className="text-xs text-red-500">
                        {errors.multaPrevista.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="jurosPrevisto"
                      className="text-sm font-medium text-slate-900 dark:text-white"
                    >
                      Juros Previstos (R$)
                    </Label>
                    <Input
                      id="jurosPrevisto"
                      type="number"
                      placeholder="0,00"
                      step="0.01"
                      {...register("jurosPrevisto")}
                      className="border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    {errors.jurosPrevisto && (
                      <p className="text-xs text-red-500">
                        {errors.jurosPrevisto.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <Label
                    htmlFor="observacoes"
                    className="text-sm font-medium text-slate-900 dark:text-white"
                  >
                    Observações / Justificativa
                  </Label>
                  <textarea
                    id="observacoes"
                    placeholder="Adicione observações importantes sobre esta conta..."
                    rows={3}
                    {...register("observacoes")}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-md text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.observacoes && (
                    <p className="text-xs text-red-500">
                      {errors.observacoes.message}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer com Botões */}
          <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={aoFecharLocal}
              disabled={carregando}
              className="dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={carregando}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {carregando ? (
                <>
                  <span className="mr-2">Salvando...</span>
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Salvar Conta
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
