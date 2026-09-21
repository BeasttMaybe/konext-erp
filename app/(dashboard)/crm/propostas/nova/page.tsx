"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createProposta,
  listarClientesProposta,
  listarProdutosProposta,
} from "@/app/actions/propostas";
import {
  propostaFormSchema,
  type PropostaFormInput,
  type PropostaFormValues,
} from "@/lib/validations/propostas";
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
import { Textarea } from "@/components/ui/textarea";

type SaveStatus = "RASCUNHO" | "ENVIADA";

type ClienteSugestao = {
  id: string;
  nomeRazaoSocial: string;
  nomeFantasia: string | null;
  documento: string;
};

type ProdutoSugestao = {
  id: string;
  nome: string;
  descricao: string | null;
  codigoBarras: string | null;
  precoVenda: number;
};

const PAYMENT_CONDITIONS = [
  "Dinheiro",
  "PIX",
  "Cartão de Débito",
  "Cartão de Crédito (À vista)",
  "Cartão de Crédito (Parcelado)",
  "Boleto",
  "TED / Transferência Bancária",
] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const toSafeNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
};

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

const defaultValues: PropostaFormInput = {
  cliente: "",
  aosCuidados: "",
  dataEmissao: new Date().toISOString().slice(0, 10),
  validade: "",
  proximoContato: "",
  equipamento: "",
  defeito: "",
  introducao: "",
  condicoesPagamento: "",
  detalhesPagamento: "",
  termosGarantia: "",
  observacoesInternas: "",
  itens: [
    {
      descricao: "",
      quantidade: 1,
      precoUnitario: 0,
      descontoPercentual: 0,
    },
  ],
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {children}
    </p>
  );
}

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card
      className={`rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.95)] backdrop-blur-xl ${className ?? ""}`}
    >
      {children}
    </Card>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Required() {
  return <span className="ml-0.5 text-rose-500" aria-hidden>*</span>;
}

function GlassInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/20 ${props.className ?? ""}`}
    />
  );
}

function GlassTextarea(props: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      {...props}
      className={`min-h-[96px] border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/20 ${props.className ?? ""}`}
    />
  );
}

export default function NovaPropostaPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [technicalContextOpen, setTechnicalContextOpen] = useState(true);
  const [paymentPreset, setPaymentPreset] = useState<string>("");
  const [saveIntent, setSaveIntent] = useState<SaveStatus | null>(null);
  const [clientesSugestoes, setClientesSugestoes] = useState<ClienteSugestao[]>([]);
  const [clientesLoading, setClientesLoading] = useState(true);
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [validadeDias, setValidadeDias] = useState("");
  const [validadeCalculadaBR, setValidadeCalculadaBR] = useState("");
  const [produtosSugestoes, setProdutosSugestoes] = useState<ProdutoSugestao[]>([]);
  const [produtosLoading, setProdutosLoading] = useState(true);
  const [produtoDropdownIndex, setProdutoDropdownIndex] = useState<number | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PropostaFormInput, unknown, PropostaFormValues>({
    resolver: zodResolver(propostaFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "itens",
  });

  const watchedItems = useWatch({ control, name: "itens" }) ?? [];
  const clienteDigitado = useWatch({ control, name: "cliente" }) ?? "";
  const dataEmissaoDigitada = useWatch({ control, name: "dataEmissao" }) ?? "";
  const clienteRegister = register("cliente");

  const lineSubtotals = useMemo(() => {
    return watchedItems.map((item) => {
      const quantity = toSafeNumber(item?.quantidade);
      const unitPrice = toSafeNumber(item?.precoUnitario);
      const discountPercent = toSafeNumber(item?.descontoPercentual);
      const gross = quantity * unitPrice;
      const discount = gross * (discountPercent / 100);
      return Math.max(0, gross - discount);
    });
  }, [watchedItems]);

  const totals = useMemo(() => {
    const subtotalBruto = watchedItems.reduce((sum, item) => {
      return sum + toSafeNumber(item?.quantidade) * toSafeNumber(item?.precoUnitario);
    }, 0);

    const descontoTotal = watchedItems.reduce((sum, item) => {
      const gross = toSafeNumber(item?.quantidade) * toSafeNumber(item?.precoUnitario);
      return sum + gross * (toSafeNumber(item?.descontoPercentual) / 100);
    }, 0);

    const valorTotal = Math.max(0, subtotalBruto - descontoTotal);
    return { subtotalBruto, descontoTotal, valorTotal };
  }, [watchedItems]);

  const lastItemFilled = watchedItems[watchedItems.length - 1]?.descricao?.trim() !== "";

  const handleAddItem = () => {
    if (!lastItemFilled) {
      toast.error("Preencha a descricao do item atual antes de adicionar outro.");
      return;
    }

    append({
      descricao: "",
      quantidade: 1,
      precoUnitario: 0,
      descontoPercentual: 0,
    });
  };

  const handleSave = (status: SaveStatus) => {
    setSaveIntent(status);

    handleSubmit(
      (values) => {
        startTransition(async () => {
          const result = await createProposta(values, status);

          if (!result.success) {
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
          router.push("/crm/propostas");
          router.refresh();
        });
      },
      () => {
        toast.error("Preencha os campos obrigatorios antes de salvar.");
      }
    )();
  };

  const handlePaymentPreset = (value: string) => {
    setPaymentPreset(value);

    setValue("condicoesPagamento", value, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const handleCalcularValidade = () => {
    const dias = Number(validadeDias);

    if (!Number.isInteger(dias) || dias <= 0) {
      toast.error("Informe um numero de dias valido para calcular a validade.");
      return;
    }

    const base = dataEmissaoDigitada
      ? new Date(`${dataEmissaoDigitada}T00:00:00`)
      : new Date();

    if (Number.isNaN(base.getTime())) {
      toast.error("Data de emissao invalida para calcular a validade.");
      return;
    }

    base.setDate(base.getDate() + dias);

    const ano = base.getFullYear();
    const mes = String(base.getMonth() + 1).padStart(2, "0");
    const dia = String(base.getDate()).padStart(2, "0");
    const validadeIso = `${ano}-${mes}-${dia}`;

    setValue("validade", validadeIso, {
      shouldValidate: true,
      shouldDirty: true,
    });

    setValidadeCalculadaBR(
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(base)
    );
  };

  const isDraftSaving = isPending && saveIntent === "RASCUNHO";
  const isFinalSaving = isPending && saveIntent === "ENVIADA";

  useEffect(() => {
    let active = true;

    const carregarClientes = async () => {
      setClientesLoading(true);
      const clientes = await listarClientesProposta();

      if (active) {
        setClientesSugestoes(clientes);
        setClientesLoading(false);
      }
    };

    void carregarClientes();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const carregarProdutos = async () => {
      setProdutosLoading(true);
      const produtos = await listarProdutosProposta();

      if (active) {
        setProdutosSugestoes(produtos);
        setProdutosLoading(false);
      }
    };

    void carregarProdutos();

    return () => {
      active = false;
    };
  }, []);

  const clienteTextoNormalizado = normalizeSearch(clienteDigitado);
  const clienteDigitos = normalizeDigits(clienteDigitado);

  const clientesFiltrados = useMemo(() => {
    if (!clienteTextoNormalizado && !clienteDigitos) return [];

    return clientesSugestoes
      .filter((cliente) => {
        const nome = normalizeSearch(cliente.nomeRazaoSocial);
        const fantasia = normalizeSearch(cliente.nomeFantasia ?? "");
        const documento = normalizeDigits(cliente.documento);

        const bateTexto =
          clienteTextoNormalizado.length > 0 &&
          (nome.includes(clienteTextoNormalizado) || fantasia.includes(clienteTextoNormalizado));
        const bateDocumento = clienteDigitos.length > 0 && documento.includes(clienteDigitos);

        return bateTexto || bateDocumento;
      })
      .slice(0, 8);
  }, [clienteDigitos, clienteTextoNormalizado, clientesSugestoes]);

  const clienteExisteNoCadastro =
    clienteTextoNormalizado.length === 0 ||
    clientesSugestoes.some((cliente) => {
      const nome = normalizeSearch(cliente.nomeRazaoSocial);
      const fantasia = normalizeSearch(cliente.nomeFantasia ?? "");
      const documento = normalizeDigits(cliente.documento);

      return (
        nome === clienteTextoNormalizado ||
        fantasia === clienteTextoNormalizado ||
        (clienteDigitos.length > 0 && documento === clienteDigitos)
      );
    });

  const showClienteWarning =
    !errors.cliente &&
    !clientesLoading &&
    clienteTextoNormalizado.length > 0 &&
    clientesFiltrados.length === 0 &&
    !clienteExisteNoCadastro;

  return (
    <form className="w-full flex flex-col bg-transparent" onSubmit={(e) => e.preventDefault()}>
      <div className="sticky top-0 z-kx-sticky border-b border-white/10 bg-slate-950/70 px-6 py-4 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 text-slate-400 hover:bg-white/5 hover:text-slate-100"
            >
              <Link href="/crm/propostas">
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-cyan-400" />
                <h1 className="truncate text-base font-semibold text-slate-100 sm:text-lg">
                  Nova Proposta Comercial
                </h1>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                Preencha os dados abaixo e salve para gerar o documento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className="hidden border-amber-400/20 bg-amber-400/10 text-amber-300 sm:inline-flex"
            >
              Rascunho
            </Badge>
            <Button
              type="button"
              className="bg-cyan-400 text-slate-950 shadow-[0_12px_32px_-12px_rgba(34,211,238,0.7)] hover:bg-cyan-300"
              onClick={() => handleSave("ENVIADA")}
              disabled={isPending}
            >
              {isFinalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Proposta
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <GlassCard>
            <div className="border-b border-white/10 px-6 py-5">
              <SectionLabel>01 - Dados gerais e contexto</SectionLabel>
              <h2 className="mt-1 text-base font-semibold text-slate-100">Identificacao da Proposta</h2>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Label className="text-slate-300">Cliente <Required /></Label>
                  <div className="relative">
                    <GlassInput
                      placeholder="Nome, razao social ou CPF/CNPJ"
                      {...clienteRegister}
                      onFocus={() => setClienteDropdownOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setClienteDropdownOpen(false), 120);
                      }}
                      onChange={(event) => {
                        clienteRegister.onChange(event);
                        if (!clienteDropdownOpen) {
                          setClienteDropdownOpen(true);
                        }
                      }}
                      className={errors.cliente ? "border-rose-500/60 focus-visible:border-rose-500" : ""}
                    />

                    {clienteDropdownOpen && clientesFiltrados.length > 0 && (
                      <div className="absolute z-kx-dropdown mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur-sm">
                        {clientesFiltrados.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setValue("cliente", cliente.nomeRazaoSocial, {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                              setClienteDropdownOpen(false);
                            }}
                            className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-white/5"
                          >
                            <span className="text-sm text-slate-100">{cliente.nomeRazaoSocial}</span>
                            <span className="text-xs text-slate-400">
                              {cliente.documento}
                              {cliente.nomeFantasia ? ` - ${cliente.nomeFantasia}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.cliente && <p className="text-xs text-rose-400">{errors.cliente.message}</p>}
                  {!errors.cliente && clientesLoading && (
                    <p className="text-xs text-slate-500">Carregando clientes cadastrados...</p>
                  )}
                  {showClienteWarning && (
                    <p className="text-xs text-amber-300">
                      Cliente nao encontrado no cadastro. Voce pode salvar normalmente mesmo assim.
                    </p>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <Label className="text-slate-300">Aos Cuidados de</Label>
                  <GlassInput
                    placeholder="Nome do responsavel / contato"
                    {...register("aosCuidados")}
                  />
                </FieldGroup>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FieldGroup>
                  <Label className="text-slate-300">Data de Emissao <Required /></Label>
                  <GlassInput
                    type="date"
                    {...register("dataEmissao")}
                    className={errors.dataEmissao ? "border-rose-500/60 focus-visible:border-rose-500" : ""}
                  />
                  {errors.dataEmissao && (
                    <p className="text-xs text-rose-400">{errors.dataEmissao.message}</p>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <Label className="text-slate-300">Validade em Dias <Required /></Label>
                  <GlassInput
                    type="number"
                    min={1}
                    value={validadeDias}
                    onChange={(event) => setValidadeDias(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCalcularValidade();
                      }
                    }}
                    placeholder="Ex: 30"
                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      errors.validade ? "border-rose-500/60 focus-visible:border-rose-500" : ""
                    }`}
                  />
                  <input type="hidden" {...register("validade")} />
                  <p className="text-xs text-slate-500">Pressione Enter para calcular a data final.</p>
                  {validadeCalculadaBR && (
                    <p className="text-xs text-cyan-300">Data calculada: {validadeCalculadaBR}</p>
                  )}
                  {errors.validade && <p className="text-xs text-rose-400">{errors.validade.message}</p>}
                </FieldGroup>

                <FieldGroup>
                  <Label className="text-slate-300">Proximo Contato</Label>
                  <GlassInput
                    type="date"
                    {...register("proximoContato")}
                  />
                </FieldGroup>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTechnicalContextOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <SectionLabel>Contexto tecnico (opcional)</SectionLabel>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
                      technicalContextOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {technicalContextOpen && (
                  <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
                    <FieldGroup>
                      <Label className="text-slate-300">Aparelho / Equipamento</Label>
                      <GlassInput
                        placeholder="Ex: iPhone 13 Pro, Notebook Dell XPS 15"
                        {...register("equipamento")}
                      />
                    </FieldGroup>

                    <FieldGroup>
                      <Label className="text-slate-300">Defeito Relatado / Solicitacao</Label>
                      <GlassInput
                        placeholder="Ex: Tela trincada, sem imagem, nao liga"
                        {...register("defeito")}
                      />
                    </FieldGroup>
                  </div>
                )}
              </div>

              <FieldGroup>
                <Label className="text-slate-300">Introducao da Proposta</Label>
                <GlassTextarea
                  rows={4}
                  placeholder="Texto de abertura que aparecera no PDF da proposta."
                  {...register("introducao")}
                />
              </FieldGroup>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="border-b border-white/10 px-6 py-5">
              <SectionLabel>02 - Itens e servicos</SectionLabel>
              <h2 className="mt-1 text-base font-semibold text-slate-100">Composicao da Proposta <Required /></h2>
              {errors.itens?.message && (
                <p className="mt-1 text-xs text-rose-400">{errors.itens.message}</p>
              )}
            </div>

            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-full">
                      Produto / Servico
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-20">
                      Qtd
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-32">
                      Preco Un.
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-24">
                      Desc (%)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-36">
                      Subtotal
                    </th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id} className="group border-b border-white/[0.06] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 align-top">
                        <div>
                          <Input
                            {...register(`itens.${index}.descricao`)}
                            placeholder="Descricao do produto ou servico"
                            onFocus={() => setProdutoDropdownIndex(index)}
                            onBlur={() => {
                              setTimeout(() => {
                                setProdutoDropdownIndex((current) =>
                                  current === index ? null : current
                                );
                              }, 120);
                            }}
                            className={`h-8 border-transparent bg-transparent px-0 text-slate-100 placeholder:text-slate-600 focus-visible:border-white/20 focus-visible:bg-slate-900/60 focus-visible:px-3 transition-all ${
                              errors.itens?.[index]?.descricao ? "border-rose-500/60 focus-visible:border-rose-500" : ""
                            }`}
                          />

                          {produtoDropdownIndex === index && !produtosLoading && (() => {
                            const termo = normalizeSearch(watchedItems[index]?.descricao ?? "");
                            if (!termo) return null;

                            const sugestoes = produtosSugestoes
                              .filter((produto) => {
                                const nome = normalizeSearch(produto.nome);
                                const descricao = normalizeSearch(produto.descricao ?? "");
                                const codigo = normalizeDigits(produto.codigoBarras ?? "");
                                const termoDigitos = normalizeDigits(termo);

                                return (
                                  nome.includes(termo) ||
                                  descricao.includes(termo) ||
                                  (termoDigitos.length > 0 && codigo.includes(termoDigitos))
                                );
                              })
                              .slice(0, 8);

                            if (sugestoes.length === 0) return null;

                            return (
                              <div className="mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur-sm">
                                {sugestoes.map((produto) => (
                                  <button
                                    key={produto.id}
                                    type="button"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      setValue(`itens.${index}.descricao`, produto.nome, {
                                        shouldValidate: true,
                                        shouldDirty: true,
                                      });
                                      setValue(`itens.${index}.precoUnitario`, produto.precoVenda, {
                                        shouldValidate: true,
                                        shouldDirty: true,
                                      });
                                      setProdutoDropdownIndex(null);
                                    }}
                                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-white/5"
                                  >
                                    <span className="text-sm text-slate-100">{produto.nome}</span>
                                    <span className="text-xs text-slate-400">
                                      {produto.codigoBarras ?? "Sem codigo"}
                                      {produto.descricao ? ` - ${produto.descricao}` : ""}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="number"
                          min={1}
                          {...register(`itens.${index}.quantidade`, { valueAsNumber: true })}
                          className="h-8 w-16 border-white/10 bg-slate-900/60 text-center text-slate-100 focus-visible:border-cyan-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          {...register(`itens.${index}.precoUnitario`, { valueAsNumber: true })}
                          placeholder="0,00"
                          className="h-8 w-28 border-white/10 bg-slate-900/60 text-right text-slate-100 placeholder:text-slate-600 focus-visible:border-cyan-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          {...register(`itens.${index}.descontoPercentual`, { valueAsNumber: true })}
                          placeholder="0"
                          className="h-8 w-16 border-white/10 bg-slate-900/60 text-center text-slate-100 placeholder:text-slate-600 focus-visible:border-cyan-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-100">
                        {formatCurrency(lineSubtotals[index] ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          aria-label="Remover item"
                          className="rounded-lg p-1.5 text-slate-600 opacity-0 transition-all hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-b border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddItem}
                disabled={!lastItemFilled || isPending}
                title={!lastItemFilled ? "Preencha a descricao do item atual antes de adicionar outro" : undefined}
                className="text-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300 disabled:cursor-not-allowed disabled:text-slate-600"
              >
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>
            </div>

            <div className="flex justify-end px-6 py-5">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Subtotal Bruto</span>
                  <span className="text-slate-200">{formatCurrency(totals.subtotalBruto)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Descontos</span>
                  <span className="text-rose-400">- {formatCurrency(totals.descontoTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="font-semibold text-slate-100">Total da Proposta</span>
                  <span className="text-lg font-bold text-cyan-300">{formatCurrency(totals.valorTotal)}</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="border-b border-white/10 px-6 py-5">
              <SectionLabel>03 - Fechamento e observacoes</SectionLabel>
              <h2 className="mt-1 text-base font-semibold text-slate-100">Condicoes e Termos</h2>
            </div>

            <div className="space-y-6 px-6 py-6">
              <FieldGroup>
                <Label className="text-slate-300">Condicoes de Pagamento</Label>
                <Select value={paymentPreset} onValueChange={handlePaymentPreset}>
                  <SelectTrigger className="border-white/10 bg-slate-900/80 text-slate-100 focus:border-cyan-400/50 focus:ring-cyan-400/20 data-[placeholder]:text-slate-500">
                    <SelectValue placeholder="Selecione a condição de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_CONDITIONS.map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {condition}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-slate-400">Detalhes do Pagamento (Opcional)</Label>
                <GlassInput
                  placeholder="Ex: Em até 3x sem juros no cartão, ou 5% de desconto no PIX."
                  {...register("detalhesPagamento")}
                />
              </FieldGroup>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Label className="text-slate-300">Termos de Garantia</Label>
                  <GlassTextarea
                    placeholder="Ex: Garantia de 90 dias para pecas originais e servicos realizados."
                    {...register("termosGarantia")}
                  />
                </FieldGroup>

                <FieldGroup>
                  <Label className="text-slate-300">Observacoes Internas</Label>
                  <GlassTextarea
                    placeholder="Notas internas (nao aparecem no PDF). Ex: cliente prefere contato por WhatsApp."
                    {...register("observacoesInternas")}
                  />
                </FieldGroup>
              </div>
            </div>
          </GlassCard>

          <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/55 px-6 py-4 backdrop-blur-xl">
            <Button
              asChild
              variant="ghost"
              className="text-slate-400 hover:bg-white/5 hover:text-slate-100"
            >
              <Link href="/crm/propostas">Cancelar</Link>
            </Button>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800/80"
                onClick={() => handleSave("RASCUNHO")}
                disabled={isPending}
              >
                {isDraftSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar como Rascunho
              </Button>
              <Button
                type="button"
                className="bg-cyan-400 text-slate-950 shadow-[0_12px_32px_-12px_rgba(34,211,238,0.7)] hover:bg-cyan-300"
                onClick={() => handleSave("ENVIADA")}
                disabled={isPending}
              >
                {isFinalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Proposta
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
