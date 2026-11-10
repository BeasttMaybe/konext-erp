"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { formClienteSchema, type FormCliente } from "@/lib/validations/crm";
import { consultarCnpjReceitaCliente } from "@/app/actions/crm";

interface PropsModalNovoCliente {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dados: FormCliente) => Promise<{ sucesso: boolean }>;
  carregando?: boolean;
  /** Quando fornecido, o modal opera em modo de edição e pré-preenche o formulário. */
  dadosIniciais?: Partial<FormCliente>;
}

const valoresPadrao: FormCliente = {
  tipoPessoa: "FISICA",
  papel: "CLIENTE",
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
  dadosIniciais,
}: PropsModalNovoCliente) {
  const modoEdicao = Boolean(dadosIniciais);
  const [abaAtiva, setAbaAtiva] = useState("dados-principais");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [mensagemCep, setMensagemCep] = useState<string | null>(null);
  const cepInicialRef = useRef("");

  const valoresIniciaisFormulario = useMemo(
    () => (dadosIniciais ? { ...valoresPadrao, ...dadosIniciais } : valoresPadrao),
    [dadosIniciais]
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormCliente>({
    resolver: zodResolver(formClienteSchema) as unknown as Resolver<FormCliente>,
    // Inicializa imediatamente com os dados do cliente quando disponíveis.
    defaultValues: valoresIniciaisFormulario,
    // Garante que valores de campos desmontados (abas inativas) sejam preservados.
    shouldUnregister: false,
  });

  const limparCep = (valor: string) => valor.replace(/\D/g, "").slice(0, 8);

  const tipoPessoa = useWatch({ control, name: "tipoPessoa" });
  const papelAtual = useWatch({ control, name: "papel" });
  const categoriaAtual = useWatch({ control, name: "categoria" });

  useEffect(() => {
    if (tipoPessoa === "JURIDICA" && categoriaAtual === "CLIENTE_FINAL") {
      setValue("categoria", "EMPRESA", { shouldDirty: true });
    }
  }, [tipoPessoa, categoriaAtual, setValue]);

  useEffect(() => {
    if (papelAtual === "FORNECEDOR" && categoriaAtual !== "EMPRESA") {
      setValue("categoria", "EMPRESA", { shouldDirty: true });
    }
  }, [papelAtual, categoriaAtual, setValue]);

  useEffect(() => {
    if (!aberto) return;

    reset(valoresIniciaisFormulario);
    cepInicialRef.current = limparCep(valoresIniciaisFormulario.cep || "");
  }, [aberto, valoresIniciaisFormulario, reset]);

  const aoCancelar = () => {
    reset(valoresPadrao);
    setAbaAtiva("dados-principais");
    setMensagemCep(null);
    aoFechar();
  };

  const aoSubmeter = async (dados: FormCliente) => {
    try {
      const resultado = await aoSalvar(dados);
      if (!resultado.sucesso) {
        // O componente pai já exibe toast de erro, mas garantimos feedback aqui também
        return;
      }
      toast.success(
        modoEdicao ? "Cliente atualizado com êxito!" : "Cliente cadastrado com êxito!"
      );
      reset(valoresPadrao);
      setAbaAtiva("dados-principais");
      setMensagemCep(null);
    } catch {
      toast.error("Falha ao salvar o cliente. Tente novamente.");
    }
  };

  const formatarCep = (valor: string) => {
    const cepLimpo = limparCep(valor);

    if (cepLimpo.length <= 5) return cepLimpo;

    return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
  };

  const buscarEnderecoPorCep = async (cepInformado: string) => {
    const cepLimpo = limparCep(cepInformado);
    const logradouroAtual = String(getValues("logradouro") || "").trim();
    const bairroAtual = String(getValues("bairro") || "").trim();
    const cidadeAtual = String(getValues("cidade") || "").trim();
    const estadoAtual = String(getValues("estado") || "").trim();
    const enderecoJaPreenchido =
      Boolean(logradouroAtual) ||
      Boolean(bairroAtual) ||
      Boolean(cidadeAtual) ||
      Boolean(estadoAtual);

    // Defesa: CEP incompleto ou vazio.
    if (!cepLimpo || cepLimpo.length !== 8) {
      return;
    }

    // Defesa: evita sobrescrever endereço já hidratado quando o CEP não mudou.
    if (cepLimpo === cepInicialRef.current && enderecoJaPreenchido) {
      return;
    }

    try {
      setBuscandoCep(true);
      setMensagemCep("Buscando endereco pelo CEP...");

      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

      if (!resposta.ok) {
        throw new Error("Falha ao consultar CEP");
      }

      const dados = (await resposta.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };

      if (dados.erro) {
        setMensagemCep("CEP nao encontrado.");
        return;
      }

      setValue("logradouro", dados.logradouro || "", { shouldDirty: true });
      setValue("bairro", dados.bairro || "", { shouldDirty: true });
      setValue("cidade", dados.localidade || "", { shouldDirty: true });
      setValue("estado", (dados.uf || "").toUpperCase(), { shouldDirty: true });
      cepInicialRef.current = cepLimpo;

      setMensagemCep("Endereco preenchido automaticamente.");
    } catch {
      setMensagemCep("Nao foi possivel buscar o CEP agora.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const buscarDadosCnpj = async () => {
    const documentoAtual = getValues("documento");

    if (tipoPessoa !== "JURIDICA") {
      toast.error("A busca na Receita e valida apenas para Pessoa Juridica.");
      return;
    }

    try {
      setBuscandoCnpj(true);
      const resultado = await consultarCnpjReceitaCliente(documentoAtual);

      if (!resultado.sucesso) {
        toast.error("CNPJ invalido ou nao encontrado na Receita.");
        return;
      }

      const dados = resultado.dados;

      setValue("nomeRazaoSocial", dados.nomeRazaoSocial, { shouldDirty: true });
      setValue("nomeFantasia", dados.nomeFantasia, { shouldDirty: true });
      setValue("documento", dados.documento, { shouldDirty: true });
      setValue("inscricaoEstadual", dados.inscricaoEstadual, { shouldDirty: true });
      setValue("telefone", dados.telefone, { shouldDirty: true });
      setValue("cep", formatarCep(dados.cep), { shouldDirty: true });
      setValue("logradouro", dados.logradouro, { shouldDirty: true });
      setValue("numero", dados.numero, { shouldDirty: true });
      setValue("bairro", dados.bairro, { shouldDirty: true });
      setValue("cidade", dados.cidade, { shouldDirty: true });
      setValue("estado", dados.estado, { shouldDirty: true });

      toast.success("Dados da empresa carregados com sucesso.");
    } catch {
      toast.error("Nao foi possivel consultar o CNPJ agora.");
    } finally {
      setBuscandoCnpj(false);
    }
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
          <DialogTitle className="text-foreground">
            {modoEdicao ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            Cadastre clientes de varejo, empresas B2B e orgaos publicos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-5">
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="dados-principais">Dados Principais</TabsTrigger>
              <TabsTrigger value="contato-endereco">Contato e Endereço</TabsTrigger>
              <TabsTrigger value="observacoes">Observações</TabsTrigger>
            </TabsList>

            {/* Usamos 'hidden' no estilo em vez de renderização condicional para manter o estado no DOM */}

            <div className={abaAtiva !== "dados-principais" ? "hidden" : "space-y-4 pt-2"}>
              <div className="space-y-2">
                <Label className="text-foreground">Registrar como</Label>
                <Controller
                  name="papel"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <Label
                        htmlFor="papel-cliente"
                        className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer"
                      >
                        <RadioGroupItem id="papel-cliente" value="CLIENTE" />
                        Cliente
                      </Label>
                      <Label
                        htmlFor="papel-fornecedor"
                        className="flex items-center gap-2 border border-border rounded-md p-3 cursor-pointer"
                      >
                        <RadioGroupItem id="papel-fornecedor" value="FORNECEDOR" />
                        Fornecedor
                      </Label>
                    </RadioGroup>
                  )}
                />
              </div>

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
                  <Label htmlFor="documento">CPF / CNPJ <span className="text-kx-legenda">(opcional)</span></Label>
                  <div className="flex items-end gap-2">
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
                    {tipoPessoa === "JURIDICA" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={buscarDadosCnpj}
                        disabled={buscandoCnpj}
                        className="whitespace-nowrap"
                      >
                        {buscandoCnpj ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4 mr-2" />
                        )}
                        {buscandoCnpj ? "Buscando..." : "Buscar Dados"}
                      </Button>
                    )}
                  </div>
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
            </div>

            <div className={abaAtiva !== "contato-endereco" ? "hidden" : "space-y-4 pt-2"}>
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
                      <Input
                        id="cep"
                        {...field}
                        maxLength={9}
                        value={formatarCep(field.value || "")}
                        onChange={(evento) => {
                          field.onChange(formatarCep(evento.target.value));
                          if (mensagemCep && !buscandoCep) {
                            setMensagemCep(null);
                          }
                        }}
                        onBlur={async (evento) => {
                          field.onBlur();
                          await buscarEnderecoPorCep(evento.target.value);
                        }}
                      />
                    )}
                  />
                  {mensagemCep && (
                    <p className="text-xs text-muted-foreground mt-1">{mensagemCep}</p>
                  )}
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
            </div>

            <div className={abaAtiva !== "observacoes" ? "hidden" : "space-y-4 pt-2"}>
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
            </div>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={aoCancelar}
              disabled={carregando || isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={carregando || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                modoEdicao ? "Salvar Alterações" : "Salvar Cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
