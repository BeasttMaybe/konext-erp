"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Calendar, Loader2 } from "lucide-react";
import {
  formRegistroCobrancaSchema,
  FormRegistroCobranca,
  opçõesCanalContato,
  opçõesStatusNegociacao,
} from "@/lib/validations/financeiro";

interface PropsModalRegistroCobranca {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dados: FormRegistroCobranca) => void;
  nomeCliente: string;
  clienteId: string;
  carregando?: boolean;
}

export function ModalRegistroCobranca({
  aberto,
  aoFechar,
  aoSalvar,
  nomeCliente,
  clienteId,
  carregando = false,
}: PropsModalRegistroCobranca) {
  const hoje = new Date();
  const hojeInput = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(hoje.getDate()).padStart(2, "0")}`;

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<any>({
    resolver: zodResolver(formRegistroCobrancaSchema),
    defaultValues: {
      clienteId,
      dataContato: hojeInput,
      canalContato: "WHATSAPP",
      statusNegociacao: "NAO_ATENDEU",
      dataPromessaPagamento: "",
      observacoes: "",
    },
  });

  const statusNegociacao = watch("statusNegociacao");

  const handleAoFechar = () => {
    reset();
    aoFechar();
  };

  const aoSubmeter = (dados: any) => {
    aoSalvar(dados);
    reset();
  };

  return (
    <Dialog open={aberto} onOpenChange={(novoEstado) => {
      if (!novoEstado) {
        handleAoFechar();
      }
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Ação de Cobrança</DialogTitle>
          <DialogDescription>
            Cliente: <span className="font-semibold text-foreground">{nomeCliente}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(aoSubmeter)}>
          <div className="space-y-4 py-4">
            {/* Canal de Contato */}
            <div>
              <Label htmlFor="canalContato" className="text-base font-semibold">
                Canal de Contato <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="canalContato"
                control={control}
                render={({ field }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className={errors.canalContato ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Selecione o canal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opçõesCanalContato.map((opcao) => (
                          <SelectItem key={opcao.valor} value={opcao.valor}>
                            {opcao.rótulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.canalContato?.message && (
                      <p className="text-sm text-red-500 mt-1">
                        {String(errors.canalContato.message)}
                      </p>
                    )}
                  </>
                )}
              />
            </div>

            {/* Status da Negociação */}
            <div>
              <Label
                htmlFor="statusNegociacao"
                className="text-base font-semibold"
              >
                Status da Negociação <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="statusNegociacao"
                control={control}
                render={({ field }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className={
                          errors.statusNegociacao ? "border-red-500" : ""
                        }
                      >
                        <SelectValue placeholder="Selecione o status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opçõesStatusNegociacao.map((opcao) => (
                          <SelectItem key={opcao.valor} value={opcao.valor}>
                            {opcao.rótulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.statusNegociacao?.message && (
                      <p className="text-sm text-red-500 mt-1">
                        {String(errors.statusNegociacao.message)}
                      </p>
                    )}
                  </>
                )}
              />
            </div>

            {/* Data de Contato */}
            <div>
              <Label htmlFor="dataContato" className="text-base font-semibold">
                Data do Contato <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="dataContato"
                control={control}
                render={({ field }) => (
                  <>
                    <div className="relative">
                      <Input
                        id="dataContato"
                        type="date"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        className={`pr-10 ${
                          errors.dataContato ? "border-red-500" : ""
                        }`}
                      />
                      <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    {errors.dataContato?.message && (
                      <p className="text-sm text-red-500 mt-1">
                        {String(errors.dataContato.message)}
                      </p>
                    )}
                  </>
                )}
              />
            </div>

            {/* Data de Promessa de Pagamento - Condicional */}
            {statusNegociacao === "PROMESSA_PAGAMENTO" && (
              <div>
                <Label
                  htmlFor="dataPromessaPagamento"
                  className="text-base font-semibold"
                >
                  Data da Promessa de Pagamento{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="dataPromessaPagamento"
                  control={control}
                  render={({ field }) => (
                    <>
                      <div className="relative">
                        <Input
                          id="dataPromessaPagamento"
                          type="date"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className={`pr-10 ${
                            errors.dataPromessaPagamento
                              ? "border-red-500"
                              : ""
                          }`}
                        />
                        <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                      {errors.dataPromessaPagamento?.message && (
                        <p className="text-sm text-red-500 mt-1">
                          {String(errors.dataPromessaPagamento.message)}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>
            )}

            {/* Observações/Resumo da Conversa */}
            <div>
              <Label htmlFor="observacoes" className="text-base font-semibold">
                Resumo da Conversa <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="observacoes"
                control={control}
                render={({ field }) => (
                  <>
                    <textarea
                      id="observacoes"
                      placeholder="Descreva o resultado da abordagem, compromissos, motivos da inadimplência, etc..."
                      {...field}
                      value={field.value || ""}
                      rows={4}
                      className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent ${
                        errors.observacoes ? "border-red-500" : "border-input"
                      }`}
                    />
                    {errors.observacoes?.message && (
                      <p className="text-sm text-red-500 mt-1">
                        {String(errors.observacoes.message)}
                      </p>
                    )}
                  </>
                )}
              />
            </div>
          </div>

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
              className="bg-amber-600 hover:bg-amber-700"
              disabled={carregando}
            >
              {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Registro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
