"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formClienteSchema, type FormCliente } from "@/lib/validations/crm";

interface PropsModalNovoCliente {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dados: FormCliente) => void;
  carregando?: boolean;
}

const valoresPadrao: FormCliente = {
  tipoPessoa: "FISICA",
  nomeRazaoSocial: "",
  nomeFantasia: "",
  documento: "",
  inscricaoEstadual: "",
  email: "",
  telefone: "",
  isWhatsapp: true,
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  categoria: "CLIENTE_FINAL",
  observacoes: "",
};

export function ModalNovoCliente({
  aberto,
  aoFechar,
  aoSalvar,
  carregando = false,
}: PropsModalNovoCliente) {
  const [abaAtiva, setAbaAtiva] = useState("dados-principais");

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormCliente>({
    resolver: zodResolver(formClienteSchema),
    defaultValues: valoresPadrao,
  });

  const tipoPessoa = watch("tipoPessoa");

  const aoCancelar = () => {
    reset(valoresPadrao);
    setAbaAtiva("dados-principais");
    aoFechar();
  };

  const aoSubmeter = (dados: FormCliente) => {
    aoSalvar(dados);
    reset(valoresPadrao);
    setAbaAtiva("dados-principais");
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        if (!estado) aoCancelar();
      }}
    >
      <DialogContent className="max-w-4xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo Cliente</DialogTitle>
          <DialogDescription>
            Cadastre clientes de varejo, empresas B2B e orgaos publicos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-5">
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="dados-principais">Dados Principais</TabsTrigger>
              <TabsTrigger value="contato-endereco">Contato e Endereco</TabsTrigger>
              <TabsTrigger value="observacoes">Observacoes</TabsTrigger>
            </TabsList>

            <TabsContent value="dados-principais" className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-foreground">Tipo de Pessoa</Label>
                <Controller
                  name="tipoPessoa"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <Label
                        htmlFor="tipo-fisica"
                        className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer"
                      >
                        <RadioGroupItem id="tipo-fisica" value="FISICA" />
                        Pessoa Fisica
                      </Label>
                      <Label
                        htmlFor="tipo-juridica"
                        className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer"
                      >
                        <RadioGroupItem id="tipo-juridica" value="JURIDICA" />
                        Pessoa Juridica
                      </Label>
                    </RadioGroup>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="nomeRazaoSocial">Nome / Razao Social</Label>
                  <Controller
                    name="nomeRazaoSocial"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="nomeRazaoSocial"
                        {...field}
                        className={errors.nomeRazaoSocial ? "border-destructive" : ""}
                      />
                    )}
                  />
                  {errors.nomeRazaoSocial?.message && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.nomeRazaoSocial.message}
                    </p>
                  )}
                </div>

                {tipoPessoa === "JURIDICA" && (
                  <div>
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <Controller
                      name="nomeFantasia"
                      control={control}
                      render={({ field }) => (
                        <Input id="nomeFantasia" {...field} value={field.value || ""} />
                      )}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="documento">CPF / CNPJ</Label>
                  <Controller
                    name="documento"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="documento"
                        {...field}
                        className={errors.documento ? "border-destructive" : ""}
                      />
                    )}
                  />
                  {errors.documento?.message && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.documento.message}
                    </p>
                  )}
                </div>

                {tipoPessoa === "JURIDICA" && (
                  <div>
                    <Label htmlFor="inscricaoEstadual">Inscricao Estadual</Label>
                    <Controller
                      name="inscricaoEstadual"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="inscricaoEstadual"
                          {...field}
                          value={field.value || ""}
                        />
                      )}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Controller
                    name="categoria"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="categoria">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLIENTE_FINAL">Cliente Final</SelectItem>
                          <SelectItem value="EMPRESA">Empresa</SelectItem>
                          <SelectItem value="ORGAO_PUBLICO">Orgao Publico</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contato-endereco" className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Controller
                    name="telefone"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="telefone"
                        {...field}
                        className={errors.telefone ? "border-destructive" : ""}
                      />
                    )}
                  />
                  {errors.telefone?.message && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.telefone.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="email"
                        type="email"
                        {...field}
                        value={field.value || ""}
                        className={errors.email ? "border-destructive" : ""}
                      />
                    )}
                  />
                  {errors.email?.message && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2 flex items-center space-x-2 border border-border rounded-md px-3 py-2">
                  <Controller
                    name="isWhatsapp"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="isWhatsapp"
                        checked={Boolean(field.value)}
                        onCheckedChange={(marcado) => field.onChange(Boolean(marcado))}
                      />
                    )}
                  />
                  <Label htmlFor="isWhatsapp" className="cursor-pointer">
                    Este numero e WhatsApp
                  </Label>
                </div>

                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Controller
                    name="cep"
                    control={control}
                    render={({ field }) => (
                      <Input id="cep" {...field} value={field.value || ""} />
                    )}
                  />
                </div>

                <div>
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Controller
                    name="logradouro"
                    control={control}
                    render={({ field }) => (
                      <Input id="logradouro" {...field} value={field.value || ""} />
                    )}
                  />
                </div>

                <div>
                  <Label htmlFor="numero">Numero</Label>
                  <Controller
                    name="numero"
                    control={control}
                    render={({ field }) => (
                      <Input id="numero" {...field} value={field.value || ""} />
                    )}
                  />
                </div>

                <div>
                  <Label htmlFor="bairro">Bairro</Label>
                  <Controller
                    name="bairro"
                    control={control}
                    render={({ field }) => (
                      <Input id="bairro" {...field} value={field.value || ""} />
                    )}
                  />
                </div>

                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Controller
                    name="cidade"
                    control={control}
                    render={({ field }) => (
                      <Input id="cidade" {...field} value={field.value || ""} />
                    )}
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Controller
                    name="estado"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="estado"
                        maxLength={2}
                        {...field}
                        value={field.value || ""}
                        className={errors.estado ? "border-destructive" : ""}
                      />
                    )}
                  />
                  {errors.estado?.message && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.estado.message}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="observacoes" className="space-y-4 pt-2">
              <div>
                <Label htmlFor="observacoes">Observacoes / Historico Inicial</Label>
                <Controller
                  name="observacoes"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      id="observacoes"
                      rows={8}
                      {...field}
                      value={field.value || ""}
                      placeholder="Descreva contexto comercial, preferencias e observacoes relevantes..."
                    />
                  )}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={aoCancelar}
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={carregando}>
              {carregando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
