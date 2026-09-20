/**
 * "Consumidor Final" (Fase 3-2C — consumidor final): um Cliente real por
 * tenant, criado uma vez na provisão do tenant (scripts/provisionar-tenant-
 * cunhado.mjs) e por uma migração de dados pros tenants já existentes
 * (prisma/migrations/20260920100000_consumidor_final), usado quando uma
 * venda de balcão no PDV não tem cliente selecionado.
 *
 * Identificado por um `id` FIXO e previsível em vez de uma coluna nova de
 * "flag": `Cliente.id` é `String @id @default(uuid())` — um TEXT sem
 * validação de formato — então nada impede criar este UM registro com um id
 * legível em vez de um uuid gerado. Isso evita a única mudança de schema que
 * a fase permitiria (uma coluna de flag) inteiramente: "é o cliente do
 * sistema?" vira uma comparação de string, em qualquer lugar do código, sem
 * migração nenhuma.
 */

export const ID_CLIENTE_CONSUMIDOR_FINAL = "consumidor-final";

/**
 * Documento sentinela, não um CPF/CNPJ real: `Cliente.documento` é
 * `@unique` e obrigatório, então o registro precisa de algum valor. Usar uma
 * string claramente não-numérica (em vez de, por exemplo, uma string vazia)
 * torna impossível colidir com o documento de um cliente real e deixa
 * autoexplicativo pra quem inspecionar o banco direto.
 */
export const DADOS_CLIENTE_CONSUMIDOR_FINAL = {
  id: ID_CLIENTE_CONSUMIDOR_FINAL,
  tipoPessoa: "FISICA" as const,
  papel: "CLIENTE" as const,
  nomeRazaoSocial: "Consumidor Final",
  documento: "CONSUMIDOR_FINAL",
  telefone: "",
  categoria: "CLIENTE_FINAL" as const,
  observacoes:
    "Cliente automático do sistema — usado para vendas de balcão no PDV sem cliente identificado. Não pode ser editado, excluído nem vinculado a uma Ordem de Serviço.",
};

export function ehClienteConsumidorFinal(clienteId: string | null | undefined): boolean {
  return clienteId === ID_CLIENTE_CONSUMIDOR_FINAL;
}

export interface ResultadoInvarianteClienteSistema {
  permitido: boolean;
  motivo?: string;
}

const PERMITIDO: ResultadoInvarianteClienteSistema = { permitido: true };

function negado(motivo: string): ResultadoInvarianteClienteSistema {
  return { permitido: false, motivo };
}

/** Mesmo formato de retorno de lib/auth/invariantes-cargos.ts (Cargo.fixo) — não há coluna "fixo" aqui, só o id previsível acima. */
export function podeEditarCliente(clienteId: string): ResultadoInvarianteClienteSistema {
  if (ehClienteConsumidorFinal(clienteId)) {
    return negado("O cliente Consumidor Final é automático do sistema: não pode ser editado.");
  }
  return PERMITIDO;
}

export function podeExcluirCliente(clienteId: string): ResultadoInvarianteClienteSistema {
  if (ehClienteConsumidorFinal(clienteId)) {
    return negado("O cliente Consumidor Final é automático do sistema: não pode ser excluído.");
  }
  return PERMITIDO;
}

/**
 * Resolve o cliente EFETIVO de uma venda de balcão: o id informado pelo
 * operador, ou o Consumidor Final quando o campo ficou vazio. Fica no
 * servidor (chamada de dentro de processarVenda) — o cliente é só
 * informativo, a decisão de "quem é o dono da venda" é sempre daqui.
 */
export function resolverClienteEfetivoPdv(clienteIdInformado: string | null | undefined): string {
  const normalizado = clienteIdInformado?.trim();
  return normalizado ? normalizado : ID_CLIENTE_CONSUMIDOR_FINAL;
}

/**
 * Verdadeiro quando a lista de pagamentos de uma venda inclui alguma forma
 * que gera uma ContaReceber (boleto, crediário, empenho público — mesmo
 * critério de lib/pdv/pagamentos.ts#ehPagamentoPrazo). Uma dívida em aberto
 * não pode ficar em nome do Consumidor Final: não tem como cobrar dele.
 *
 * Genérica em T (em vez de fixar `formaPagamento: string`) porque os dois
 * chamadores reais (app/actions/pdv.ts, components/pdv/modal-pagamento.tsx)
 * passam sua própria união de literais (FormaPagamentoPdv) tanto na lista
 * quanto no predicado — TypeScript não aceita um predicado `(f: string) =>
 * boolean` onde um `(f: FormaPagamentoPdv) => boolean` é esperado
 * (contravariância de parâmetro), então fixar em `string` aqui quebraria
 * ambas as chamadas reais.
 */
export function exigeClienteRealParaFinalizarVenda<T extends string>(
  pagamentos: Array<{ formaPagamento: T }>,
  ehPagamentoPrazo: (formaPagamento: T) => boolean
): boolean {
  return pagamentos.some((pagamento) => ehPagamentoPrazo(pagamento.formaPagamento));
}

/**
 * Interface mínima de `prisma.cliente` aceita tanto pelo client operacional
 * real quanto por um mock em teste — mesmo truque de tipagem estreita de
 * lib/central/cargos-padrao.ts#ClienteCargoParaProvisionamento, pro mesmo
 * motivo: este módulo também é importado direto por um script .mjs sem
 * bundler (scripts/provisionar-tenant-cunhado.mjs), então não pode depender
 * de nada específico do Next.js nem do client Prisma inteiro.
 */
export type ClienteDelegateParaProvisionamento = {
  cliente: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: { data: typeof DADOS_CLIENTE_CONSUMIDOR_FINAL }) => Promise<{ id: string }>;
  };
};

/**
 * Garante que o Consumidor Final existe no banco operacional do tenant.
 * Idempotente (mesmo padrão de criarConfiguracaoInicial em
 * provisionar-tenant-cunhado.mjs): reexecutar não duplica nem falha.
 */
export async function garantirClienteConsumidorFinal(
  prismaTenant: ClienteDelegateParaProvisionamento
): Promise<{ criado: boolean }> {
  const existente = await prismaTenant.cliente.findUnique({
    where: { id: ID_CLIENTE_CONSUMIDOR_FINAL },
    select: { id: true },
  });

  if (existente) {
    return { criado: false };
  }

  await prismaTenant.cliente.create({ data: DADOS_CLIENTE_CONSUMIDOR_FINAL });
  return { criado: true };
}
