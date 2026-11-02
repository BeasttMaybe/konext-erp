"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
 ArrowLeft,
 CalendarDays,
 Check,
 ChevronsUpDown,
 CircleDollarSign,
 ClipboardCheck,
 Package2,
 Plus,
 ShieldCheck,
 Trash2,
 Truck,
 UserRound,
} from "lucide-react";
import { Controller, SubmitErrorHandler, SubmitHandler, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
 Command,
 CommandEmpty,
 CommandGroup,
 CommandInput,
 CommandItem,
 CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createPedidoVenda } from "@/app/actions/vendas";
import { cn } from "@/lib/utils";
import { deDecimal, dividirEmParcelas, paraMoeda } from "@/lib/dinheiro";

const tabValues = [
 "dados-gerais",
 "itens-pedido",
 "logistica-frete",
 "pagamento-impostos",
] as const;

type TabValue = (typeof tabValues)[number];

const paymentMethodValues = [
 "pix",
 "ted",
 "boleto",
 "cartao-debito",
 "cartao-credito-avista",
 "cartao-credito-parcelado",
] as const;

type PaymentMethodValue = (typeof paymentMethodValues)[number];

type ComboboxOption = {
 id: string;
 name: string;
};

type ProductOption = ComboboxOption & {
 price: number;
};

type ProposalInitialData = {
 proposalId: string;
 clientName: string;
 paymentConditions: string | null;
 items: Array<{
 descricao: string;
 quantidade: number;
 precoUnitario: number;
 descontoPercentual: number;
 }>;
};

const pedidoVendaItemSchema = z.object({
 produtoId: z.string().optional(),
 nome: z.string().min(1, "O nome do produto é obrigatório"),
 quantidade: z.number().min(1, "A quantidade mínima é 1"),
 precoUnitario: z.number().min(0, "O preço unitário não pode ser negativo"),
 descontoPorcentagem: z.number().min(0, "O desconto não pode ser negativo"),
 subtotal: z.number(),
});

const pedidoVendaParcelaSchema = z.object({
 vencimento: z.date({
 error: "A data de vencimento é obrigatória",
 }),
 valor: z.number().min(0, "O valor da parcela não pode ser negativo"),
});

export const pedidoVendaSchema = z.object({
 cliente: z.string().min(1, "O nome do cliente é obrigatório"),
 dataVenda: z.date({
 error: "A data da venda é obrigatória",
 }),
 vendedor: z.string().min(1, "O vendedor é obrigatório"),
 dataSaida: z.date().optional(),
 listaPrecos: z.string().optional(),
 referencia: z.string().optional(),
 obsNfe: z.string().optional(),
 obsInterna: z.string().optional(),
 itens: z.array(pedidoVendaItemSchema).min(1, "O pedido deve conter ao menos um item"),
 formaPagamento: z.string().min(1, "A forma de pagamento é obrigatória"),
 acrescimos: z.number(),
 descontos: z.number(),
 parcelas: z.array(pedidoVendaParcelaSchema),
});

type PedidoVendaFormValues = z.infer<typeof pedidoVendaSchema>;

const mockSellers: ComboboxOption[] = [
 { id: "vendedor-gabriel", name: "Gabriel Vieira" },
 { id: "vendedor-carlos", name: "Carlos Almeida" },
 { id: "vendedor-marina", name: "Marina Rocha" },
];

const formatCurrency = (value: number) =>
 new Intl.NumberFormat("pt-BR", {
 style: "currency",
 currency: "BRL",
 }).format(value);

const freightValue = 0;

const today = new Date();

const fieldTabMap: Record<string, TabValue> = {
 cliente: "dados-gerais",
 dataVenda: "dados-gerais",
 vendedor: "dados-gerais",
 dataSaida: "dados-gerais",
 listaPrecos: "dados-gerais",
 referencia: "dados-gerais",
 obsNfe: "dados-gerais",
 obsInterna: "dados-gerais",
 itens: "itens-pedido",
 formaPagamento: "pagamento-impostos",
 parcelas: "pagamento-impostos",
};

const formatDateInputValue = (value?: Date) => {
 if (!value || Number.isNaN(value.getTime())) {
 return "";
 }

 const year = value.getFullYear();
 const month = `${value.getMonth() + 1}`.padStart(2, "0");
 const day = `${value.getDate()}`.padStart(2, "0");

 return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string) => {
 if (!value) {
 return undefined;
 }

 return new Date(`${value}T00:00:00`);
};

const normalizeText = (value: string) =>
 value
 .normalize("NFD")
 .replace(/[\u0300-\u036f]/g, "")
 .toLocaleLowerCase("pt-BR")
 .trim();

function mapPaymentConditionsToMethod(
 paymentConditions: string | null | undefined
): PaymentMethodValue {
 const normalized = normalizeText(paymentConditions ?? "");

 if (normalized.includes("pix")) return "pix";
 if (normalized.includes("ted") || normalized.includes("transferencia")) return "ted";
 if (normalized.includes("boleto")) return "boleto";
 if (normalized.includes("debito")) return "cartao-debito";
 if (normalized.includes("parcelado")) return "cartao-credito-parcelado";
 if (normalized.includes("credito") || normalized.includes("a vista") || normalized.includes("avista")) {
 return "cartao-credito-avista";
 }

 return "pix";
}

function findClientIdByName(clientName: string, clientOptions: ComboboxOption[]): string {
 const normalizedClient = normalizeText(clientName);
 const exactMatch = clientOptions.find(
 (option) => normalizeText(option.name) === normalizedClient
 );

 if (exactMatch) {
 return exactMatch.id;
 }

 const containsMatch = clientOptions.find((option) =>
 normalizeText(option.name).includes(normalizedClient)
 );

 return containsMatch?.id ?? "";
}

function mapProposalItemsToOrderItems(
 proposalItems: ProposalInitialData["items"],
 productOptions: ProductOption[]
): PedidoVendaFormValues["itens"] {
 return proposalItems.map((item) => {
 const normalizedDescription = normalizeText(item.descricao);
 const productMatch = productOptions.find(
 (product) => normalizeText(product.name) === normalizedDescription
 ) ??
 productOptions.find((product) =>
 normalizeText(product.name).includes(normalizedDescription)
 );

 const subtotal =
 item.quantidade * item.precoUnitario * (1 - item.descontoPercentual / 100);

 return {
 produtoId: productMatch?.id,
 nome: item.descricao,
 quantidade: item.quantidade,
 precoUnitario: item.precoUnitario,
 descontoPorcentagem: item.descontoPercentual,
 subtotal,
 };
 });
}

function SectionHeader({
 icon: Icon,
 title,
 description,
}: {
 icon: React.ComponentType<{ className?: string }>;
 title: string;
 description: string;
}) {
 return (
 <div className="flex items-start gap-4">
 <div className="flex h-11 w-11 items-center justify-center rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao text-kx-link shadow-inner shadow-kx-cartao">
 <Icon className="h-5 w-5" />
 </div>
 <div className="space-y-1">
 <h2 className="text-lg font-semibold text-kx-texto">{title}</h2>
 <p className="text-sm text-kx-legenda">{description}</p>
 </div>
 </div>
 );
}

function SearchableComboboxField({
 label,
 placeholder,
 searchPlaceholder,
 emptyMessage,
 value,
 onChange,
 options,
 errorMessage,
}: {
 label: string;
 placeholder: string;
 searchPlaceholder: string;
 emptyMessage: string;
 value?: string;
 onChange: (value: string) => void;
 options: ComboboxOption[];
 errorMessage?: string;
}) {
 const [open, setOpen] = useState(false);
 const selectedOption = options.find((option) => option.id === value);

 return (
 <div className="space-y-2">
 <Label>{label}</Label>
 <Popover open={open} onOpenChange={setOpen}>
 <PopoverTrigger asChild>
 <Button
 type="button"
 variant="outline"
 role="combobox"
 aria-expanded={open}
 className="h-10 w-full justify-between border-kx-painel-borda bg-kx-superficie px-3 text-kx-texto hover:bg-kx-painel/80"
 >
 <span className={cn("truncate", !selectedOption && "text-kx-legenda")}>
 {selectedOption ? selectedOption.name : placeholder}
 </span>
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-kx-legenda" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-kx-painel-borda bg-kx-fundo p-0 text-kx-texto">
 <Command className="bg-transparent">
 <CommandInput placeholder={searchPlaceholder} />
 <CommandList>
 <CommandEmpty>{emptyMessage}</CommandEmpty>
 <CommandGroup>
 {options.map((option) => (
 <CommandItem
 key={option.id}
 value={`${option.name} ${option.id}`}
 onSelect={() => {
 onChange(option.id);
 setOpen(false);
 }}
 >
 <Check
 className={cn(
 "h-4 w-4 text-kx-sucesso-texto transition-opacity",
 option.id === value ? "opacity-100" : "opacity-0"
 )}
 />
 <span>{option.name}</span>
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 {errorMessage && <p className="text-xs text-kx-erro-texto">{errorMessage}</p>}
 </div>
 );
}

function TabFooter({
 isFirst,
 onBack,
 onNext,
 showNext = true,
}: {
 isFirst: boolean;
 onBack: () => void;
 onNext: () => void;
 showNext?: boolean;
}) {
 return (
 <div className="mt-6 flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:flex-row sm:items-center sm:justify-between">
 <Button
 type="button"
 variant="outline"
 size="lg"
 onClick={onBack}
 disabled={isFirst}
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto hover:bg-kx-painel/80"
 >
 <ArrowLeft className="h-4 w-4" />
 Voltar
 </Button>

 {showNext && (
 <Button
 type="button"
 size="lg"
 onClick={onNext}
 className="bg-kx-sucesso px-6 text-primary-foreground shadow-kx-flutuante hover:bg-kx-sucesso"
 >
 Avançar
 </Button>
 )}
 </div>
 );
}

export function NewSalesOrderWizard({
 clientOptions,
 productOptions,
 initialData,
}: {
 clientOptions: ComboboxOption[];
 productOptions: ProductOption[];
 initialData?: ProposalInitialData | null;
}) {
 const router = useRouter();
 const [activeTab, setActiveTab] = useState<TabValue>("dados-gerais");
 const [draftProduto, setDraftProduto] = useState<ProductOption | null>(null);
 const [draftQtd, setDraftQtd] = useState(1);
 const [draftPreco, setDraftPreco] = useState(0);
 const [draftDesc, setDraftDesc] = useState(0);
 const [installmentCount, setInstallmentCount] = useState(1);
 const [installmentIntervalDays, setInstallmentIntervalDays] = useState(30);
 const [submissionError, setSubmissionError] = useState<string | null>(null);

 const defaultValues: PedidoVendaFormValues = initialData
 ? {
 cliente: findClientIdByName(initialData.clientName, clientOptions),
 dataVenda: today,
 vendedor: "",
 dataSaida: undefined,
 listaPrecos: "corporativa-premium",
 referencia: `Proposta #${initialData.proposalId.slice(0, 6).toUpperCase()}`,
 obsNfe: "",
 obsInterna: "",
 itens: mapProposalItemsToOrderItems(initialData.items, productOptions),
 formaPagamento: mapPaymentConditionsToMethod(initialData.paymentConditions),
 acrescimos: 0,
 descontos: 0,
 parcelas: [],
 }
 : {
 cliente: "",
 dataVenda: today,
 vendedor: "",
 dataSaida: undefined,
 listaPrecos: "corporativa-premium",
 referencia: "",
 obsNfe: "",
 obsInterna: "",
 itens: [],
 formaPagamento: "pix",
 acrescimos: 0,
 descontos: 0,
 parcelas: [],
 };

 const form = useForm<PedidoVendaFormValues>({
 resolver: zodResolver(pedidoVendaSchema),
 defaultValues,
 });

 const activeTabIndex = tabValues.indexOf(activeTab);
 const isFirstTab = activeTabIndex === 0;
 const isLastTab = activeTabIndex === tabValues.length - 1;
 const {
 append,
 fields,
 remove,
 } = useFieldArray({
 control: form.control,
 name: "itens",
 });
 const { fields: installmentFields, replace: replaceInstallments } = useFieldArray({
 control: form.control,
 name: "parcelas",
 });
 const watchedItems = useWatch({
 control: form.control,
 name: "itens",
 }) ?? [];
 const watchedPaymentMethod = useWatch({
 control: form.control,
 name: "formaPagamento",
 });
 const watchedAdditional = useWatch({
 control: form.control,
 name: "acrescimos",
 }) ?? 0;
 const watchedDiscounts = useWatch({
 control: form.control,
 name: "descontos",
 }) ?? 0;
 const watchedInstallments = useWatch({
 control: form.control,
 name: "parcelas",
 }) ?? [];
 const watchedSalesDate = useWatch({
 control: form.control,
 name: "dataVenda",
 });
 const allowsInstallments =
 watchedPaymentMethod === "boleto" || watchedPaymentMethod === "cartao-credito-parcelado";
 const netPrice = draftPreco * (1 - draftDesc / 100);
 const draftSubtotal = netPrice * draftQtd;
 const productSubtotal = watchedItems.reduce((total, item) => total + (item?.subtotal ?? 0), 0);
 const totalQuantity = watchedItems.reduce((total, item) => total + (item?.quantidade ?? 0), 0);
 const totalDiscount = watchedItems.reduce((total, item) => {
 const quantity = item?.quantidade ?? 0;
 const unitPrice = item?.precoUnitario ?? 0;
 const discountPercentage = item?.descontoPorcentagem ?? 0;

 return total + quantity * unitPrice * (discountPercentage / 100);
 }, 0);
 const grandTotal = productSubtotal + watchedAdditional - watchedDiscounts + freightValue;
 const {
 control,
 formState: { errors },
 handleSubmit,
 register,
 setValue,
 } = form;

 const goToPreviousTab = () => {
 if (isFirstTab) return;
 setActiveTab(tabValues[activeTabIndex - 1]);
 };

 const goToNextTab = () => {
 if (isLastTab) return;
 setActiveTab(tabValues[activeTabIndex + 1]);
 };

 useEffect(() => {
 replaceInstallments([]);
 setValue("parcelas", [], { shouldDirty: true, shouldValidate: true });
 }, [replaceInstallments, setValue, watchedPaymentMethod]);

 const handleAddItem = () => {
 if (!draftProduto || draftQtd < 1 || draftPreco < 0 || draftDesc < 0) {
 return;
 }

 const subtotal = draftQtd * draftPreco * (1 - draftDesc / 100);

 append({
 produtoId: draftProduto.id,
 nome: draftProduto.name,
 quantidade: draftQtd,
 precoUnitario: draftPreco,
 descontoPorcentagem: draftDesc,
 subtotal,
 });

 setDraftProduto(null);
 setDraftQtd(1);
 setDraftPreco(0);
 setDraftDesc(0);
 };

 const handleGenerateInstallments = () => {
 if (!allowsInstallments) {
 return;
 }

 const normalizedInstallmentCount = Math.max(1, Math.floor(installmentCount));
 const normalizedIntervalDays = Math.max(1, Math.floor(installmentIntervalDays));
 const baseDate = watchedSalesDate ?? today;
 // Centavo-exato (Fase 2A-2 cont.): dividirEmParcelas (lib/dinheiro.ts) é
 // a única forma sancionada de partir um total em N parcelas que somam
 // exatamente o total — a divisão manual anterior (Math.floor + resto na
 // ÚLTIMA parcela) duplicava essa fórmula fora do módulo autorizado.
 const parcelasCentavos = dividirEmParcelas(deDecimal(grandTotal), normalizedInstallmentCount);

 const nextInstallments = parcelasCentavos.map((centavos, index) => {
 const dueDate = new Date(baseDate);
 dueDate.setDate(dueDate.getDate() + normalizedIntervalDays * (index + 1));

 return {
 vencimento: dueDate,
 valor: paraMoeda(centavos),
 };
 });

 replaceInstallments(nextInstallments);
 setValue("parcelas", nextInstallments, { shouldDirty: true, shouldValidate: true });
 };

 const handleFormSubmit: SubmitHandler<PedidoVendaFormValues> = async (values) => {
 setSubmissionError(null);

 const selectedSellerName =
 mockSellers.find((seller) => seller.id === values.vendedor)?.name ?? values.vendedor;

 const result = await createPedidoVenda({
 ...values,
 vendedor: selectedSellerName,
 });

 if (!result.success) {
 setSubmissionError(result.message);
 return;
 }

 router.push("/vendas/historico");
 router.refresh();
 };

 const handleFormInvalid: SubmitErrorHandler<PedidoVendaFormValues> = (errors) => {
 const firstErrorField = Object.keys(errors)[0];

 if (firstErrorField && fieldTabMap[firstErrorField]) {
 setActiveTab(fieldTabMap[firstErrorField]);
 }

 const firstErrorMessage = errors[firstErrorField as keyof typeof errors]?.message;

 setSubmissionError(
 typeof firstErrorMessage === "string"
 ? firstErrorMessage
 : "Revise os campos obrigatórios do pedido antes de salvar."
 );
 };

 return (
 <div className="w-full min-h-full flex flex-col bg-transparent">
 <div className="border-b border-kx-painel-borda bg-kx-painel px-6 py-6 lg:px-8">
 <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
 <div>
 <div className="inline-flex items-center rounded-full border border-kx-sucesso bg-kx-sucesso-fundo px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-kx-sucesso-texto">
 Pedido de Venda
 </div>
 {initialData && (
 <div className="mt-3 inline-flex items-center rounded-full border border-kx-primaria bg-kx-info-fundo px-3 py-1 text-xs font-medium text-kx-link">
 Preenchido automaticamente via Proposta #{initialData.proposalId.slice(0, 6).toUpperCase()}
 </div>
 )}
 <h1 className="mt-4 text-3xl font-semibold tracking-tight text-kx-texto lg:text-4xl">
 Novo Pedido de Venda
 </h1>
 <p className="mt-3 max-w-3xl text-sm leading-6 text-kx-texto-2/80 lg:text-base">
 Estruture o pedido comercial com dados gerais, composição de itens, logística e fechamento financeiro.
 </p>
 </div>

 <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-superficie p-5 shadow-kx-flutuante xl:max-w-sm">
 <div className="space-y-2">
 <p className="text-xs font-medium uppercase tracking-[0.24em] text-kx-legenda">Resumo rápido</p>
 <p className="text-2xl font-semibold text-kx-texto">{formatCurrency(grandTotal)}</p>
 <p className="text-sm text-kx-legenda">Total projetado com frete, descontos e ajustes do pedido.</p>
 </div>
 </Card>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
 <div className="mx-auto max-w-7xl">
 <form onSubmit={handleSubmit(handleFormSubmit, handleFormInvalid)} noValidate>
 <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="space-y-6">
 <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-2 text-kx-legenda lg:grid-cols-4">
 <TabsTrigger value="dados-gerais" className="rounded-xl py-3 data-[state=active]:bg-kx-superficie data-[state=active]:text-kx-texto">
 Dados Gerais
 </TabsTrigger>
 <TabsTrigger value="itens-pedido" className="rounded-xl py-3 data-[state=active]:bg-kx-superficie data-[state=active]:text-kx-texto">
 Itens do Pedido
 </TabsTrigger>
 <TabsTrigger value="logistica-frete" className="rounded-xl py-3 data-[state=active]:bg-kx-superficie data-[state=active]:text-kx-texto">
 Logística e Frete
 </TabsTrigger>
 <TabsTrigger value="pagamento-impostos" className="rounded-xl py-3 data-[state=active]:bg-kx-superficie data-[state=active]:text-kx-texto">
 Pagamento e Impostos
 </TabsTrigger>
 </TabsList>

 <TabsContent value="dados-gerais" className="mt-0">
 <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 shadow-kx-painel">
 <div className="space-y-8">
 <SectionHeader
 icon={ClipboardCheck}
 title="Dados Gerais"
 description="Defina os responsáveis e informações centrais do pedido comercial."
 />

 <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-2">
 <Controller
 control={control}
 name="cliente"
 render={({ field }) => (
 <SearchableComboboxField
 label="Cliente"
 placeholder="Selecione um cliente"
 searchPlaceholder="Buscar cliente..."
 emptyMessage="Nenhum cliente encontrado."
 value={field.value}
 onChange={field.onChange}
 options={clientOptions}
 errorMessage={errors.cliente?.message}
 />
 )}
 />

 <div className="space-y-2">
 <Label htmlFor="data-venda">Data da Venda</Label>
 <Controller
 control={control}
 name="dataVenda"
 render={({ field }) => (
 <div className="relative">
 <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda" />
 <Input
 id="data-venda"
 type="date"
 className="border-kx-painel-borda bg-kx-superficie pl-10 text-kx-texto"
 value={formatDateInputValue(field.value)}
 onChange={(event) => field.onChange(parseDateInputValue(event.target.value))}
 />
 </div>
 )}
 />
 {errors.dataVenda && <p className="text-xs text-kx-erro-texto">{errors.dataVenda.message}</p>}
 </div>

 <Controller
 control={control}
 name="vendedor"
 render={({ field }) => (
 <SearchableComboboxField
 label="Vendedor"
 placeholder="Selecione um vendedor"
 searchPlaceholder="Buscar vendedor..."
 emptyMessage="Nenhum vendedor encontrado."
 value={field.value}
 onChange={field.onChange}
 options={mockSellers}
 errorMessage={errors.vendedor?.message}
 />
 )}
 />

 <div className="space-y-2">
 <Label htmlFor="data-saida-prevista">Data de Saída Prevista</Label>
 <Controller
 control={control}
 name="dataSaida"
 render={({ field }) => (
 <div className="relative">
 <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kx-legenda" />
 <Input
 id="data-saida-prevista"
 type="date"
 className="border-kx-painel-borda bg-kx-superficie pl-10 text-kx-texto"
 value={formatDateInputValue(field.value)}
 onChange={(event) => field.onChange(parseDateInputValue(event.target.value))}
 />
 </div>
 )}
 />
 {errors.dataSaida && <p className="text-xs text-kx-erro-texto">{errors.dataSaida.message}</p>}
 </div>
 </div>

 <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr]">
 <div className="space-y-2">
 <Label>Lista de Preços</Label>
 <Controller
 control={control}
 name="listaPrecos"
 render={({ field }) => (
 <Select value={field.value} onValueChange={field.onChange}>
 <SelectTrigger className="border-kx-painel-borda bg-kx-superficie text-kx-texto">
 <SelectValue placeholder="Selecione a lista de preços" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="corporativa-premium">Lista Corporativa Premium</SelectItem>
 <SelectItem value="varejo">Lista Padrão de Varejo</SelectItem>
 <SelectItem value="revenda">Lista Especial para Revenda</SelectItem>
 </SelectContent>
 </Select>
 )}
 />
 {errors.listaPrecos && <p className="text-xs text-kx-erro-texto">{errors.listaPrecos.message}</p>}
 </div>

 <div className="space-y-2">
 <Label htmlFor="referencia-pedido">Referência do Pedido</Label>
 <Input
 id="referencia-pedido"
 placeholder="Informe uma referência comercial"
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto placeholder:text-kx-legenda"
 {...register("referencia")}
 />
 {errors.referencia && <p className="text-xs text-kx-erro-texto">{errors.referencia.message}</p>}
 </div>
 </div>

 <div className="grid gap-5 xl:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="observacoes-nfe">Observações da Nota Fiscal (NF-e)</Label>
 <p className="text-xs leading-5 text-kx-legenda">
 Informações que serão impressas no DANFE para o cliente e fisco
 </p>
 <Textarea
 id="observacoes-nfe"
 placeholder="Descreva informações fiscais e comerciais que devem constar na NF-e"
 className="min-h-36 border-kx-painel-borda bg-kx-superficie text-kx-texto placeholder:text-kx-legenda"
 {...register("obsNfe")}
 />
 {errors.obsNfe && <p className="text-xs text-kx-erro-texto">{errors.obsNfe.message}</p>}
 </div>

 <div className="space-y-2">
 <Label htmlFor="observacoes-internas">Observações Internas</Label>
 <p className="text-xs leading-5 text-kx-legenda">
 Notas ocultas para controle interno da equipe
 </p>
 <Textarea
 id="observacoes-internas"
 placeholder="Registre observações internas para acompanhamento comercial e operacional"
 className="min-h-36 border-kx-painel-borda bg-kx-superficie text-kx-texto placeholder:text-kx-legenda"
 {...register("obsInterna")}
 />
 {errors.obsInterna && <p className="text-xs text-kx-erro-texto">{errors.obsInterna.message}</p>}
 </div>
 </div>
 </div>
 </Card>

 <TabFooter isFirst={true} onBack={goToPreviousTab} onNext={goToNextTab} />
 </TabsContent>

 <TabsContent value="itens-pedido" className="mt-0">
 <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 shadow-kx-painel">
 <div className="space-y-8">
 <SectionHeader
 icon={Package2}
 title="Itens do Pedido"
 description="Visualize a composição do pedido com preços, descontos e subtotal por item."
 />

 <div className="grid gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-superficie p-4 xl:grid-cols-[minmax(0,1.5fr)_90px_130px_110px_150px_160px_auto] xl:items-end">
 <div className="space-y-2">
 <Label>Produto</Label>
 <Popover>
 <PopoverTrigger asChild>
 <Button
 type="button"
 variant="outline"
 role="combobox"
 className="h-8 w-full justify-between rounded-lg border-kx-painel-borda bg-kx-painel px-2.5 py-1 text-base font-normal text-kx-texto shadow-none hover:bg-kx-painel hover:text-kx-texto md:text-sm"
 >
 <span className={cn("truncate", !draftProduto && "text-kx-legenda")}>
 {draftProduto ? draftProduto.name : "Buscar produto..."}
 </span>
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-kx-legenda" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-kx-painel-borda bg-kx-fundo p-0 text-kx-texto">
 <Command className="bg-transparent">
 <CommandInput placeholder="Buscar produto..." />
 <CommandList>
 <CommandEmpty>Nenhum produto encontrado no estoque.</CommandEmpty>
 <CommandGroup>
 {productOptions.map((product) => (
 <CommandItem
 key={product.id}
 value={`${product.name} ${product.id}`}
 onSelect={() => {
 setDraftProduto(product);
 setDraftPreco(product.price);
 }}
 >
 <Check
 className={cn(
 "h-4 w-4 text-kx-sucesso-texto transition-opacity",
 draftProduto?.id === product.id ? "opacity-100" : "opacity-0"
 )}
 />
 <span className="flex-1 truncate">{product.name}</span>
 <span className="text-xs text-kx-legenda">{formatCurrency(product.price)}</span>
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 </div>

 <div className="space-y-2">
 <Label htmlFor="qtd-rapida">Qtd</Label>
 <Input
 id="qtd-rapida"
 type="number"
 min={1}
 placeholder="1"
 className="border-kx-painel-borda bg-kx-painel text-kx-texto placeholder:text-kx-legenda [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 value={draftQtd}
 onChange={(event) => setDraftQtd(Number(event.target.value) || 1)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="preco-unitario-rapido">Preço Un.</Label>
 <Input
 id="preco-unitario-rapido"
 type="number"
 min={0}
 step="0.01"
 placeholder="0,00"
 className="border-kx-painel-borda bg-kx-painel text-kx-texto placeholder:text-kx-legenda [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 value={draftPreco}
 onChange={(event) => setDraftPreco(Number(event.target.value) || 0)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="desconto-rapido">Desc (%)</Label>
 <Input
 id="desconto-rapido"
 type="number"
 min={0}
 step="0.01"
 placeholder="0"
 className="border-kx-painel-borda bg-kx-painel text-kx-texto placeholder:text-kx-legenda [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 value={draftDesc}
 onChange={(event) => setDraftDesc(Number(event.target.value) || 0)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="preco-liquido-rapido">Preço Líquido</Label>
 <Input
 id="preco-liquido-rapido"
 value={formatCurrency(netPrice)}
 readOnly
 tabIndex={-1}
 className="border-kx-painel-borda bg-kx-painel text-kx-texto-2"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="subtotal-rapido">Subtotal</Label>
 <Input
 id="subtotal-rapido"
 value={formatCurrency(draftSubtotal)}
 readOnly
 tabIndex={-1}
 className="border-kx-painel-borda bg-kx-painel text-kx-texto-2"
 />
 </div>

 <Button
 type="button"
 size="lg"
 onClick={handleAddItem}
 className="bg-kx-primaria px-5 text-primary-foreground shadow-kx-flutuante hover:bg-kx-primaria xl:self-end"
 >
 <Plus className="h-4 w-4" />
 Adicionar
 </Button>
 </div>

 <div className="overflow-hidden rounded-kx-cartao border border-kx-painel-borda bg-kx-superficie">
 <Table>
 <TableHeader className="border-kx-painel-borda bg-kx-cartao">
 <TableRow className="border-kx-painel-borda hover:bg-transparent">
 <TableHead className="text-kx-texto-2">Produto</TableHead>
 <TableHead className="text-kx-texto-2">Qtd</TableHead>
 <TableHead className="text-kx-texto-2">Preço Unitário</TableHead>
 <TableHead className="text-kx-texto-2">Desconto</TableHead>
 <TableHead className="text-right text-kx-texto-2">Subtotal</TableHead>
 <TableHead className="text-right text-kx-texto-2">Ações</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {fields.length === 0 ? (
 <TableRow className="border-kx-painel-borda hover:bg-transparent">
 <TableCell colSpan={6} className="py-8 text-center text-kx-legenda">
 Nenhum item adicionado ao pedido.
 </TableCell>
 </TableRow>
 ) : (
 fields.map((field, index) => {
 const item = watchedItems[index] ?? field;

 return (
 <TableRow key={field.id} className="border-kx-painel-borda hover:bg-kx-painel/[0.03]">
 <TableCell className="font-medium text-kx-texto">{item.nome}</TableCell>
 <TableCell className="text-kx-texto-2">{item.quantidade}</TableCell>
 <TableCell className="text-kx-texto-2">{formatCurrency(item.precoUnitario)}</TableCell>
 <TableCell className="text-kx-texto-2">{item.descontoPorcentagem}%</TableCell>
 <TableCell className="text-right font-semibold text-kx-sucesso-texto">{formatCurrency(item.subtotal)}</TableCell>
 <TableCell className="text-right">
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => remove(index)}
 className="h-8 w-8 text-kx-erro-texto hover:bg-kx-erro-fundo hover:text-kx-erro-texto"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </TableCell>
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>

 <div className="grid gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-superficie p-4 sm:grid-cols-2 xl:grid-cols-4">
 <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-4">
 <p className="text-xs uppercase tracking-[0.18em] text-kx-legenda">Nº de Itens</p>
 <p className="mt-2 text-2xl font-semibold text-kx-texto">{watchedItems.length}</p>
 </div>
 <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-4">
 <p className="text-xs uppercase tracking-[0.18em] text-kx-legenda">Soma das Quantidades</p>
 <p className="mt-2 text-2xl font-semibold text-kx-texto">{totalQuantity}</p>
 </div>
 <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-4">
 <p className="text-xs uppercase tracking-[0.18em] text-kx-legenda">Total de Descontos</p>
 <p className="mt-2 text-2xl font-semibold text-kx-erro-texto">-{formatCurrency(totalDiscount)}</p>
 </div>
 <div className="rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-4">
 <p className="text-xs uppercase tracking-[0.18em] text-kx-legenda">Total dos Itens</p>
 <p className="mt-2 text-2xl font-semibold text-kx-sucesso-texto">{formatCurrency(productSubtotal)}</p>
 </div>
 </div>
 </div>
 </Card>

 <TabFooter isFirst={false} onBack={goToPreviousTab} onNext={goToNextTab} />
 </TabsContent>

 <TabsContent value="logistica-frete" className="mt-0">
 <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 shadow-kx-painel">
 <div className="space-y-8">
 <SectionHeader
 icon={Truck}
 title="Logística e Frete"
 description="Organize a entrega, os custos de transporte e o endereço de destino."
 />

 <div className="flex flex-col items-center justify-center rounded-kx-painel border border-dashed border-kx-painel-borda bg-kx-superficie px-8 py-12 text-center">
 <Truck className="h-14 w-14 text-kx-legenda/60" />
 <h3 className="mt-6 text-2xl font-semibold text-kx-texto">Módulo em Manutenção</h3>
 <p className="mt-3 max-w-2xl text-sm leading-7 text-kx-legenda">
 A gestão avançada de logística e fretes está sendo estruturada e será liberada em breve. O faturamento atual não exige o preenchimento destes dados.
 </p>
 </div>
 </div>
 </Card>

 <TabFooter isFirst={false} onBack={goToPreviousTab} onNext={goToNextTab} />
 </TabsContent>

 <TabsContent value="pagamento-impostos" className="mt-0">
 <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
 <Card className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 shadow-kx-painel">
 <div className="space-y-8">
 <SectionHeader
 icon={ShieldCheck}
 title="Pagamento e Impostos"
 description="Defina condições, ajustes financeiros e informações tributárias do pedido."
 />

 <div className="grid gap-5 md:grid-cols-2">
 <div className="space-y-2 md:col-span-2">
 <Label>Forma de Pagamento</Label>
 <Controller
 control={control}
 name="formaPagamento"
 render={({ field }) => (
 <Select value={field.value} onValueChange={field.onChange}>
 <SelectTrigger className="border-kx-painel-borda bg-kx-superficie text-kx-texto lg:flex-1">
 <SelectValue placeholder="Selecione a forma de pagamento" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pix">PIX</SelectItem>
 <SelectItem value="ted">TED</SelectItem>
 <SelectItem value="boleto">Boleto</SelectItem>
 <SelectItem value="cartao-debito">Cartão de Débito</SelectItem>
 <SelectItem value="cartao-credito-avista">Cartão de Crédito (À vista)</SelectItem>
 <SelectItem value="cartao-credito-parcelado">Cartão de Crédito (Parcelado)</SelectItem>
 </SelectContent>
 </Select>
 )}
 />

 {allowsInstallments && (
 <div className="mt-4 grid gap-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-superficie p-4 shadow-inner shadow-kx-cartao animate-in fade-in-0 zoom-in-95 duration-300 md:grid-cols-[140px_160px_auto] md:items-end">
 <div className="space-y-2">
 <Label htmlFor="numero-parcelas">Nº de Parcelas</Label>
 <Input
 id="numero-parcelas"
 type="number"
 min={1}
 max={watchedPaymentMethod === "cartao-credito-parcelado" ? 12 : undefined}
 value={installmentCount}
 onChange={(event) => setInstallmentCount(Number(event.target.value) || 1)}
 className="border-kx-painel-borda bg-kx-painel text-kx-texto placeholder:text-kx-legenda [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="intervalo-dias">Intervalo de Dias</Label>
 <Input
 id="intervalo-dias"
 type="number"
 min={1}
 value={installmentIntervalDays}
 onChange={(event) => setInstallmentIntervalDays(Number(event.target.value) || 30)}
 className="border-kx-painel-borda bg-kx-painel text-kx-texto placeholder:text-kx-legenda [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 />
 </div>

 <Button
 type="button"
 variant="outline"
 size="lg"
 onClick={handleGenerateInstallments}
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto hover:bg-kx-painel/80"
 >
 Gerar Parcelas
 </Button>
 </div>
 )}

 {allowsInstallments && installmentFields.length > 0 && (
 <div className="mt-4 space-y-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-superficie p-4">
 {installmentFields.map((installmentField, index) => (
 <div key={installmentField.id} className="grid gap-3 md:grid-cols-[80px_1fr_180px] md:items-end">
 <div className="space-y-2">
 <Label>{`${index + 1}x`}</Label>
 <div className="flex h-8 items-center rounded-lg border border-kx-painel-borda bg-kx-painel px-2.5 text-sm text-kx-texto-2">
 {`${index + 1}x`}
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor={`parcelas-${index}-vencimento`}>Data de Vencimento</Label>
 <Controller
 control={control}
 name={`parcelas.${index}.vencimento`}
 render={({ field }) => (
 <Input
 id={`parcelas-${index}-vencimento`}
 type="date"
 className="border-kx-painel-borda bg-kx-painel text-kx-texto"
 value={formatDateInputValue(field.value)}
 onChange={(event) => field.onChange(parseDateInputValue(event.target.value))}
 />
 )}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor={`parcelas-${index}-valor`}>Valor</Label>
 <Input
 id={`parcelas-${index}-valor`}
 type="number"
 min={0}
 step="0.01"
 className="border-kx-painel-borda bg-kx-painel text-kx-texto [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 {...register(`parcelas.${index}.valor`, { valueAsNumber: true })}
 />
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="space-y-2 md:col-span-2">
 <Label>Categoria Financeira</Label>
 <Select defaultValue="venda-mercadorias">
 <SelectTrigger className="border-kx-painel-borda bg-kx-superficie text-kx-texto">
 <SelectValue placeholder="Selecione a categoria financeira" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="venda-mercadorias">Venda de Mercadorias</SelectItem>
 <SelectItem value="prestacao-servicos">Prestação de Serviços</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="acrescimos">Acréscimos</Label>
 <Controller
 control={control}
 name="acrescimos"
 render={({ field }) => (
 <Input
 id="acrescimos"
 type="number"
 min={0}
 step="0.01"
 value={field.value}
 onChange={(event) => field.onChange(Number(event.target.value) || 0)}
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 />
 )}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="descontos">Descontos</Label>
 <Controller
 control={control}
 name="descontos"
 render={({ field }) => (
 <Input
 id="descontos"
 type="number"
 min={0}
 step="0.01"
 value={field.value}
 onChange={(event) => field.onChange(Number(event.target.value) || 0)}
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
 />
 )}
 />
 </div>
 </div>
 </div>
 </Card>

 <Card className="rounded-kx-painel border border-kx-sucesso bg-[linear-gradient(180deg,rgba(15,23,42,0.85),rgba(2,6,23,0.9))] p-6 shadow-kx-flutuante">
 <div className="space-y-6">
 <div className="space-y-2">
 <p className="text-xs font-medium uppercase tracking-[0.24em] text-kx-sucesso-texto">Resumo Financeiro</p>
 <h2 className="text-2xl font-semibold text-kx-texto">Total Geral</h2>
 </div>

 <div className="space-y-4 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel/[0.03] p-5">
 <div className="flex items-center justify-between text-sm text-kx-texto-2">
 <span>Subtotal dos Itens</span>
 <span>{formatCurrency(productSubtotal)}</span>
 </div>
 <div className="flex items-center justify-between text-sm text-kx-texto-2">
 <span>Frete</span>
 <span>{formatCurrency(freightValue)}</span>
 </div>
 <div className="flex items-center justify-between text-sm text-kx-texto-2">
 <span>Acréscimos</span>
 <span>{formatCurrency(watchedAdditional)}</span>
 </div>
 <div className="flex items-center justify-between text-sm text-kx-erro-texto">
 <span>Descontos</span>
 <span>-{formatCurrency(watchedDiscounts)}</span>
 </div>

 <div className="border-t border-kx-painel-borda pt-4">
 <div className="space-y-5">
 <div>
 <p className="text-sm text-kx-legenda">Valor final do pedido</p>
 <p className="mt-2 text-3xl font-semibold text-kx-sucesso-texto">{formatCurrency(grandTotal)}</p>
 </div>

 <Button
 type="submit"
 size="lg"
 className="h-14 w-full rounded-kx-cartao bg-kx-sucesso text-base font-semibold text-primary-foreground shadow-kx-flutuante hover:bg-kx-sucesso"
 >
 Salvar Pedido
 </Button>

 {submissionError && (
 <p className="text-sm text-kx-erro-texto">{submissionError}</p>
 )}
 </div>
 </div>
 </div>
 </div>
 </Card>
 </div>

 <TabFooter isFirst={false} onBack={goToPreviousTab} onNext={goToNextTab} showNext={false} />
 </TabsContent>
 </Tabs>
 </form>
 </div>
 </div>
 </div>
 );
}