"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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
 atualizarProposta,
 createProposta,
 listarClientesProposta,
 listarProdutosProposta,
} from "@/app/actions/propostas";
import { calcularProposta } from "@/lib/dominio/propostas/calculo";
import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";
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
 documento: string | null;
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

/**
 * O formulario de proposta, usado para CRIAR e para EDITAR.
 *
 * Ele era a propria pagina `/crm/propostas/nova`. Quando a edicao passou a
 * existir, a escolha era duplicar 800 linhas de formulario ou dar a ele um
 * modo. Duplicado, o formulario de editar iria divergir do de criar campo a
 * campo, e o dono acabaria com duas telas que pedem coisas diferentes para
 * o mesmo documento.
 *
 * `proposta` ausente = criar. Presente = editar aquela proposta.
 */
export type PropostaParaEditar = {
 id: string;
 /** `atualizadoEm` de quando a tela carregou — trava otimista na gravacao. */
 atualizadoEm: string;
 valores: PropostaFormInput;
};

const defaultValues: PropostaFormInput = {
 cliente: "",
 aosCuidados: "",
 // Data LOCAL de quem esta na tela. `toISOString()` devolve a data em UTC:
 // das 21h a meia-noite de Brasilia ja e "amanha" em UTC, e toda proposta
 // criada nesse horario nascia com a data de emissao do dia seguinte.
 dataEmissao: format(new Date(), "yyyy-MM-dd"),
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
 <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-kx-legenda">
 {children}
 </p>
 );
}

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
 return (
 <Card
 className={`rounded-kx-painel border border-kx-painel-borda bg-kx-painel shadow-kx-painel ${className ?? ""}`}
 >
 {children}
 </Card>
 );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
 return <div className="space-y-2">{children}</div>;
}

function Required() {
 return <span className="ml-0.5 text-kx-erro-texto" aria-hidden>*</span>;
}

function GlassInput(props: React.ComponentProps<typeof Input>) {
 return (
 <Input
 {...props}
 className={`border-kx-painel-borda bg-kx-superficie text-kx-texto placeholder:text-kx-legenda focus-visible:border-kx-primaria focus-visible:ring-kx-foco ${props.className ?? ""}`}
 />
 );
}

function GlassTextarea(props: React.ComponentProps<typeof Textarea>) {
 return (
 <Textarea
 {...props}
 className={`min-h-[96px] border-kx-painel-borda bg-kx-superficie text-kx-texto placeholder:text-kx-legenda focus-visible:border-kx-primaria focus-visible:ring-kx-foco ${props.className ?? ""}`}
 />
 );
}

export function FormularioDeProposta({ proposta }: { proposta?: PropostaParaEditar }) {
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
 // Editando, os valores da proposta entram AQUI, no estado inicial do
 // formulario -- inclusive os itens, que o `useFieldArray` abaixo lê
 // deste mesmo lugar. Era isto que faltava: a tela de editar abria com o
 // formulario em branco, como se fosse uma proposta nova.
 //
 // Montado uma vez (a pagina de edicao so renderiza este componente com a
 // proposta ja carregada), entao nao ha o que re-sincronizar depois --
 // que seria o reset dentro de efeito que o
 // `react-hooks/set-state-in-effect` recusa, com razao.
 defaultValues: proposta?.valores ?? defaultValues,
 });

 const { fields, append, remove } = useFieldArray({
 control,
 name: "itens",
 });

 // O `?? []` criava um array novo a CADA renderizacao quando nao havia itens,
 // e os `useMemo` abaixo, que dependem dele, recalculavam sempre. Com a
 // referencia estavel, a conta so refaz quando os itens mudam de verdade.
 const itensObservados = useWatch({ control, name: "itens" });
 const watchedItems = useMemo(() => itensObservados ?? [], [itensObservados]);
 const clienteDigitado = useWatch({ control, name: "cliente" }) ?? "";
 const dataEmissaoDigitada = useWatch({ control, name: "dataEmissao" }) ?? "";
 const clienteRegister = register("cliente");

 // A PREVIA USA A CONTA DO SERVIDOR, nao uma copia dela.
 //
 // Esta tela somava em ponto flutuante por conta propria. Duas contas para
 // o mesmo documento significa que a tela pode mostrar um total e o banco
 // gravar outro -- e o cliente ve o numero da TELA. Pior: a copia daqui
 // somava o desconto cheio no total enquanto travava a linha em zero, entao
 // um desconto acima de 100% num item abatia os outros.
 //
 // `calcularProposta` e pura (nao toca banco nem sessao), entao roda aqui
 // igual roda la.
 const calculada = useMemo(
 () =>
 calcularProposta(
 watchedItems.map((item) => ({
 descricao: item?.descricao ?? "",
 quantidade: toSafeNumber(item?.quantidade),
 precoUnitario: toSafeNumber(item?.precoUnitario),
 descontoPercentual: toSafeNumber(item?.descontoPercentual),
 }))
 ),
 [watchedItems]
 );

 const lineSubtotals = useMemo(
 () => calculada.itens.map((item) => paraMoeda(item.linhaSubtotalCentavos)),
 [calculada]
 );

 const totals = useMemo(
 () => ({
 subtotalBruto: paraMoeda(calculada.subtotalBrutoCentavos),
 descontoTotal: paraMoeda(calculada.descontoTotalCentavos),
 valorTotal: paraMoeda(calculada.valorTotalCentavos),
 }),
 [calculada]
 );

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
 // Editando, o `status` NAO viaja: o botao salva o texto do
 // documento, nao reabre nem reenvia a proposta. Quem quer marcar
 // como enviada tem a acao propria no menu.
 if (proposta) {
 const resultado = await atualizarProposta({
 propostaId: proposta.id,
 dados: values,
 atualizadoEmEsperado: proposta.atualizadoEm,
 });

 if (!resultado.sucesso) {
 toast.error(resultado.erro);
 return;
 }

 toast.success(resultado.mensagem);
 router.push(`/crm/propostas/${proposta.id}`);
 router.refresh();
 return;
 }

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
 const documento = normalizeDigits(cliente.documento ?? "");

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
 const documento = normalizeDigits(cliente.documento ?? "");

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
 <div className="sticky top-0 z-kx-sticky border-b border-kx-painel-borda bg-kx-painel px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
 <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
 <div className="flex items-center gap-4 min-w-0">
 <Button
 asChild
 variant="ghost"
 size="sm"
 className="shrink-0 text-kx-legenda hover:bg-kx-cartao hover:text-kx-texto"
 >
 <Link href="/crm/propostas">
 <ChevronLeft className="h-4 w-4" />
 Voltar
 </Link>
 </Button>

 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <FileText className="h-4 w-4 shrink-0 text-kx-link" />
 <h1 className="truncate text-base font-semibold text-kx-texto sm:text-lg">
 Nova Proposta Comercial
 </h1>
 </div>
 <p className="hidden text-xs text-kx-legenda sm:block">
 Preencha os dados abaixo e salve para gerar o documento.
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 <Badge
 variant="outline"
 className="hidden border-kx-alerta bg-kx-alerta-fundo text-kx-alerta-texto sm:inline-flex"
 >
 Rascunho
 </Badge>
 <Button
 type="button"
 className="bg-kx-primaria text-primary-foreground shadow-kx-flutuante hover:bg-kx-primaria"
 onClick={() => handleSave("ENVIADA")}
 disabled={isPending}
 >
 {isFinalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
 Salvar Proposta
 </Button>
 </div>
 </div>
 </div>

 <div className="px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
 <div className="mx-auto max-w-5xl space-y-6">
 <GlassCard>
 <div className="border-b border-kx-painel-borda px-4 py-4 sm:px-6 sm:py-5">
 <SectionLabel>01 - Dados gerais e contexto</SectionLabel>
 <h2 className="mt-1 text-base font-semibold text-kx-texto">Identificacao da Proposta</h2>
 </div>

 <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-6">
 <div className="grid gap-4 sm:grid-cols-2">
 <FieldGroup>
 <Label className="text-kx-texto-2">Cliente <Required /></Label>
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
 className={errors.cliente ? "border-kx-erro-borda focus-visible:border-kx-erro-borda" : ""}
 />

 {clienteDropdownOpen && clientesFiltrados.length > 0 && (
 <div className="absolute z-kx-dropdown mt-1 w-full rounded-kx-cartao border border-kx-painel-borda bg-kx-fundo p-1 shadow-xl">
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
 className="flex w-full flex-col rounded-kx-cartao px-3 py-2 text-left hover:bg-kx-cartao"
 >
 <span className="text-sm text-kx-texto">{cliente.nomeRazaoSocial}</span>
 <span className="text-xs text-kx-legenda">
 {cliente.documento}
 {cliente.nomeFantasia ? ` - ${cliente.nomeFantasia}` : ""}
 </span>
 </button>
 ))}
 </div>
 )}
 </div>
 {errors.cliente && <p className="text-xs text-kx-erro-texto">{errors.cliente.message}</p>}
 {!errors.cliente && clientesLoading && (
 <p className="text-xs text-kx-legenda">Carregando clientes cadastrados...</p>
 )}
 {showClienteWarning && (
 <p className="text-xs text-kx-alerta-texto">
 Cliente nao encontrado no cadastro. Voce pode salvar normalmente mesmo assim.
 </p>
 )}
 </FieldGroup>

 <FieldGroup>
 <Label className="text-kx-texto-2">Aos Cuidados de</Label>
 <GlassInput
 placeholder="Nome do responsavel / contato"
 {...register("aosCuidados")}
 />
 </FieldGroup>
 </div>

 <div className="grid gap-4 sm:grid-cols-3">
 <FieldGroup>
 <Label className="text-kx-texto-2">Data de Emissao <Required /></Label>
 <GlassInput
 type="date"
 {...register("dataEmissao")}
 className={errors.dataEmissao ? "border-kx-erro-borda focus-visible:border-kx-erro-borda" : ""}
 />
 {errors.dataEmissao && (
 <p className="text-xs text-kx-erro-texto">{errors.dataEmissao.message}</p>
 )}
 </FieldGroup>

 <FieldGroup>
 <Label className="text-kx-texto-2">Validade em Dias <Required /></Label>
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
 errors.validade ? "border-kx-erro-borda focus-visible:border-kx-erro-borda" : ""
 }`}
 />
 <input type="hidden" {...register("validade")} />
 <p className="text-xs text-kx-legenda">Pressione Enter para calcular a data final.</p>
 {validadeCalculadaBR && (
 <p className="text-xs text-kx-link">Data calculada: {validadeCalculadaBR}</p>
 )}
 {errors.validade && <p className="text-xs text-kx-erro-texto">{errors.validade.message}</p>}
 </FieldGroup>

 <FieldGroup>
 <Label className="text-kx-texto-2">Proximo Contato</Label>
 <GlassInput
 type="date"
 {...register("proximoContato")}
 />
 </FieldGroup>
 </div>

 <div className="rounded-kx-cartao border border-kx-painel-borda/[0.07] bg-kx-painel/[0.02] overflow-hidden">
 <button
 type="button"
 onClick={() => setTechnicalContextOpen((prev) => !prev)}
 className="flex w-full items-center justify-between px-4 py-3.5 text-left sm:px-5 transition-colors hover:bg-kx-painel/[0.03]"
 >
 <SectionLabel>Contexto tecnico (opcional)</SectionLabel>
 <ChevronDown
 className={`h-4 w-4 shrink-0 text-kx-legenda transition-transform duration-200 ${
 technicalContextOpen ? "rotate-180" : ""
 }`}
 />
 </button>

 {technicalContextOpen && (
 <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
 <FieldGroup>
 <Label className="text-kx-texto-2">Aparelho / Equipamento</Label>
 <GlassInput
 placeholder="Ex: iPhone 13 Pro, Notebook Dell XPS 15"
 {...register("equipamento")}
 />
 </FieldGroup>

 <FieldGroup>
 <Label className="text-kx-texto-2">Defeito Relatado / Solicitacao</Label>
 <GlassInput
 placeholder="Ex: Tela trincada, sem imagem, nao liga"
 {...register("defeito")}
 />
 </FieldGroup>
 </div>
 )}
 </div>

 <FieldGroup>
 <Label className="text-kx-texto-2">Introducao da Proposta</Label>
 <GlassTextarea
 rows={4}
 placeholder="Texto de abertura que aparecera no PDF da proposta."
 {...register("introducao")}
 />
 </FieldGroup>
 </div>
 </GlassCard>

 <GlassCard>
 <div className="border-b border-kx-painel-borda px-4 py-4 sm:px-6 sm:py-5">
 <SectionLabel>02 - Itens e servicos</SectionLabel>
 <h2 className="mt-1 text-base font-semibold text-kx-texto">Composicao da Proposta <Required /></h2>
 {errors.itens?.message && (
 <p className="mt-1 text-xs text-kx-erro-texto">{errors.itens.message}</p>
 )}
 </div>

 <div className="overflow-x-auto overflow-y-visible">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-kx-painel-borda bg-kx-painel/[0.02]">
 <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-kx-legenda w-full">
 Produto / Servico
 </th>
 <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-kx-legenda w-20">
 Qtd
 </th>
 <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-kx-legenda w-32">
 Preco Un.
 </th>
 <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-kx-legenda w-24">
 Desc (%)
 </th>
 <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-kx-legenda w-36">
 Subtotal
 </th>
 <th className="px-4 py-3 w-10" />
 </tr>
 </thead>
 <tbody>
 {fields.map((field, index) => (
 <tr key={field.id} className="group border-b border-kx-painel-borda/[0.06] hover:bg-kx-painel/[0.02]">
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
 className={`h-8 border-transparent bg-transparent px-0 text-kx-texto placeholder:text-kx-texto-2 focus-visible:border-kx-painel-borda focus-visible:bg-kx-superficie focus-visible:px-3 transition-all ${
 errors.itens?.[index]?.descricao ? "border-kx-erro-borda focus-visible:border-kx-erro-borda" : ""
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
 <div className="mt-1 max-h-48 w-full overflow-y-auto rounded-kx-cartao border border-kx-painel-borda bg-kx-fundo p-1 shadow-xl">
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
 className="flex w-full flex-col rounded-kx-cartao px-3 py-2 text-left hover:bg-kx-cartao"
 >
 <span className="text-sm text-kx-texto">{produto.nome}</span>
 <span className="text-xs text-kx-legenda">
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
 className="h-8 w-16 border-kx-painel-borda bg-kx-superficie text-center text-kx-texto focus-visible:border-kx-primaria [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
 />
 </td>
 <td className="px-4 py-2.5">
 <Input
 // `setValueAs` no lugar de `valueAsNumber`: o campo virou texto para
 // aceitar a virgula, e `valueAsNumber` devolveria NaN para "8.153,90".
 // O leitor unico converte, e o schema continua recebendo numero.
 type="text"
 inputMode="decimal"
 {...register(`itens.${index}.precoUnitario`, {
 setValueAs: (valor) => paraMoeda(lerEntradaMonetaria(valor) ?? 0),
 })}
 placeholder="0,00"
 className="h-8 w-28 border-kx-painel-borda bg-kx-superficie text-right text-kx-texto placeholder:text-kx-texto-2 focus-visible:border-kx-primaria [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
 className="h-8 w-16 border-kx-painel-borda bg-kx-superficie text-center text-kx-texto placeholder:text-kx-texto-2 focus-visible:border-kx-primaria [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
 />
 </td>
 <td className="px-4 py-2.5 text-right font-medium text-kx-texto">
 {formatCurrency(lineSubtotals[index] ?? 0)}
 </td>
 <td className="px-4 py-2.5 text-center">
 <button
 type="button"
 onClick={() => remove(index)}
 disabled={fields.length === 1}
 aria-label="Remover item"
 className="rounded-kx-cartao p-1.5 text-kx-texto-2 opacity-0 transition-all hover:bg-kx-erro-fundo hover:text-kx-erro-texto group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="px-4 py-4 border-b border-kx-painel-borda sm:px-6">
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={handleAddItem}
 disabled={!lastItemFilled || isPending}
 title={!lastItemFilled ? "Preencha a descricao do item atual antes de adicionar outro" : undefined}
 className="text-kx-link hover:bg-kx-info-fundo hover:text-kx-link disabled:cursor-not-allowed disabled:text-kx-texto-2"
 >
 <Plus className="h-4 w-4" />
 Adicionar Item
 </Button>
 </div>

 <div className="flex justify-end px-4 py-4 sm:px-6 sm:py-5">
 <div className="w-full max-w-xs space-y-2">
 <div className="flex items-center justify-between text-sm text-kx-legenda">
 <span>Subtotal Bruto</span>
 <span className="text-kx-texto">{formatCurrency(totals.subtotalBruto)}</span>
 </div>
 <div className="flex items-center justify-between text-sm text-kx-legenda">
 <span>Descontos</span>
 <span className="text-kx-erro-texto">- {formatCurrency(totals.descontoTotal)}</span>
 </div>
 <div className="flex items-center justify-between border-t border-kx-painel-borda pt-2">
 <span className="font-semibold text-kx-texto">Total da Proposta</span>
 <span className="text-lg font-bold text-kx-link">{formatCurrency(totals.valorTotal)}</span>
 </div>
 </div>
 </div>
 </GlassCard>

 <GlassCard>
 <div className="border-b border-kx-painel-borda px-4 py-4 sm:px-6 sm:py-5">
 <SectionLabel>03 - Fechamento e observacoes</SectionLabel>
 <h2 className="mt-1 text-base font-semibold text-kx-texto">Condicoes e Termos</h2>
 </div>

 <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-6">
 <FieldGroup>
 <Label className="text-kx-texto-2">Condicoes de Pagamento</Label>
 <Select value={paymentPreset} onValueChange={handlePaymentPreset}>
 <SelectTrigger className="border-kx-painel-borda bg-kx-superficie text-kx-texto focus:border-kx-primaria focus:ring-kx-foco data-[placeholder]:text-kx-legenda">
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
 <Label className="text-kx-legenda">Detalhes do Pagamento (Opcional)</Label>
 <GlassInput
 placeholder="Ex: Em até 3x sem juros no cartão, ou 5% de desconto no PIX."
 {...register("detalhesPagamento")}
 />
 </FieldGroup>

 <div className="grid gap-4 sm:grid-cols-2">
 <FieldGroup>
 <Label className="text-kx-texto-2">Termos de Garantia</Label>
 <GlassTextarea
 placeholder="Ex: Garantia de 90 dias para pecas originais e servicos realizados."
 {...register("termosGarantia")}
 />
 </FieldGroup>

 <FieldGroup>
 <Label className="text-kx-texto-2">Observacoes Internas</Label>
 <GlassTextarea
 placeholder="Notas internas (nao aparecem no PDF). Ex: cliente prefere contato por WhatsApp."
 {...register("observacoesInternas")}
 />
 </FieldGroup>
 </div>
 </div>
 </GlassCard>

 <div className="flex flex-wrap items-center justify-between gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel px-4 py-4 sm:px-6">
 <Button
 asChild
 variant="ghost"
 className="text-kx-legenda hover:bg-kx-cartao hover:text-kx-texto"
 >
 <Link href="/crm/propostas">Cancelar</Link>
 </Button>

 <div className="flex flex-wrap items-center justify-end gap-3">
 <Button
 type="button"
 variant="outline"
 className="border-kx-painel-borda bg-kx-superficie text-kx-texto hover:bg-kx-painel/80"
 onClick={() => handleSave("RASCUNHO")}
 disabled={isPending}
 >
 {isDraftSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
 Salvar como Rascunho
 </Button>
 <Button
 type="button"
 className="bg-kx-primaria text-primary-foreground shadow-kx-flutuante hover:bg-kx-primaria"
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
