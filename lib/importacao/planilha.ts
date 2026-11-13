import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";
import { UNIDADES_DE_MEDIDA } from "@/lib/dominio/estoque/preco";

/**
 * Importar clientes e produtos por planilha (CSV).
 *
 * O Excel "Salvar como -> CSV" em portugues sai com ponto e virgula; o Google
 * Planilhas, com virgula. Os dois funcionam: o separador e detectado pela
 * linha de titulo. Titulos sao reconhecidos com e sem acento e por apelidos
 * ("Celular", "Fone" e "Telefone" sao o mesmo campo).
 *
 * Aqui so se le e se confere cada linha. Gravar e com as actions, que
 * conferem tudo de novo.
 */

export const LIMITE_DE_LINHAS = 2000;
/** Linhas por chamada ao servidor (cada uma passa pela action de cadastro). */
export const TAMANHO_DO_LOTE_CLIENTES = 100;
export const TAMANHO_DO_LOTE_PRODUTOS = 50;

/** Separador pela linha de titulo: o que mais aparece entre ; , e tab. */
export function detectarSeparador(primeiraLinha: string): string {
  const contagem = [";", ",", "\t"].map((s) => [s, primeiraLinha.split(s).length - 1] as const);
  contagem.sort((a, b) => b[1] - a[1]);
  return contagem[0][1] > 0 ? contagem[0][0] : ";";
}

/** CSV com aspas ("a; b" e aspas dobradas ""), quebra de linha dentro de aspas e BOM do Excel. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const separador = detectarSeparador(limpo.split(/\r?\n/, 1)[0] ?? "");
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (entreAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo === "") entreAspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

function chave(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export type Coluna<C extends string> = { campo: C; titulo: string; apelidos: readonly string[]; obrigatoria?: boolean; exemplo: string };

/** Para cada campo, o indice da coluna na planilha (ou -1). */
export function mapearColunas<C extends string>(titulos: readonly string[], colunas: readonly Coluna<C>[]): Record<C, number> {
  const chaves = titulos.map(chave);
  const mapa = {} as Record<C, number>;
  for (const coluna of colunas) {
    const candidatos = [coluna.titulo, ...coluna.apelidos].map(chave);
    mapa[coluna.campo] = chaves.findIndex((t) => candidatos.includes(t));
  }
  return mapa;
}

export type Registro<C extends string> = Record<C, string>;

export function registrosDaPlanilha<C extends string>(
  linhas: string[][],
  colunas: readonly Coluna<C>[]
): { registros: Array<{ numero: number; registro: Registro<C> }>; faltando: string[] } {
  const [titulos = [], ...dados] = linhas;
  const mapa = mapearColunas(titulos, colunas);
  const faltando = colunas.filter((c) => c.obrigatoria && mapa[c.campo] < 0).map((c) => c.titulo);
  const registros = dados.map((linha, indice) => {
    const registro = {} as Registro<C>;
    for (const coluna of colunas) {
      const i = mapa[coluna.campo];
      registro[coluna.campo] = i >= 0 ? (linha[i] ?? "").trim() : "";
    }
    // +2: a linha 1 da planilha e o titulo, e a contagem comeca em 1.
    return { numero: indice + 2, registro };
  });
  return { registros, faltando };
}

/** Planilha-modelo: titulos e uma linha de exemplo, com ; (abre direto no Excel). */
export function modeloCsv<C extends string>(colunas: readonly Coluna<C>[]): string {
  const celula = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [colunas.map((c) => celula(c.titulo)).join(";"), colunas.map((c) => celula(c.exemplo)).join(";")].join("\r\n") + "\r\n";
}

export type Conversao<T> = { ok: true; dados: T } | { ok: false; erro: string };

// ─── Clientes ────────────────────────────────────────────────────────────────

export type CampoCliente = "nome" | "telefone" | "documento" | "email" | "cep" | "logradouro" | "numero" | "bairro" | "cidade" | "estado" | "observacoes";

export const COLUNAS_CLIENTE: readonly Coluna<CampoCliente>[] = [
  { campo: "nome", titulo: "Nome", apelidos: ["nome completo", "cliente", "razao social", "nome/razao social"], obrigatoria: true, exemplo: "Maria Souza" },
  { campo: "telefone", titulo: "Telefone", apelidos: ["celular", "fone", "whatsapp", "telefone celular"], obrigatoria: true, exemplo: "(11) 98765-4321" },
  { campo: "documento", titulo: "CPF/CNPJ", apelidos: ["cpf", "cnpj", "documento", "cpf cnpj"], exemplo: "123.456.789-09" },
  { campo: "email", titulo: "E-mail", apelidos: ["email", "e mail"], exemplo: "maria@email.com" },
  { campo: "cep", titulo: "CEP", apelidos: [], exemplo: "01001-000" },
  { campo: "logradouro", titulo: "Endereço", apelidos: ["endereco", "rua", "logradouro"], exemplo: "Rua das Flores" },
  { campo: "numero", titulo: "Número", apelidos: ["numero", "n", "nro"], exemplo: "123" },
  { campo: "bairro", titulo: "Bairro", apelidos: [], exemplo: "Centro" },
  { campo: "cidade", titulo: "Cidade", apelidos: ["municipio"], exemplo: "São Paulo" },
  { campo: "estado", titulo: "UF", apelidos: ["estado", "uf"], exemplo: "SP" },
  { campo: "observacoes", titulo: "Observações", apelidos: ["observacoes", "obs", "observacao"], exemplo: "" },
];

export type ClienteImportado = {
  nomeRazaoSocial: string;
  telefone: string;
  documento?: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacoes?: string;
};

const soDigitos = (v: string) => v.replace(/\D/g, "");

export function converterCliente(r: Registro<CampoCliente>): Conversao<ClienteImportado> {
  const nome = r.nome.replace(/\s+/g, " ").trim();
  if (nome.length < 3) return { ok: false, erro: "Nome com menos de 3 letras." };
  let telefone = soDigitos(r.telefone);
  if (telefone.startsWith("55") && telefone.length >= 12) telefone = telefone.slice(2);
  if (telefone.length < 10 || telefone.length > 11) return { ok: false, erro: "Telefone precisa ter DDD + número (10 ou 11 dígitos)." };
  const documento = soDigitos(r.documento);
  if (documento && documento.length !== 11 && documento.length !== 14) return { ok: false, erro: "CPF/CNPJ com quantidade errada de dígitos." };
  const email = r.email.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };
  const estado = r.estado.trim().toUpperCase();
  if (estado && !/^[A-Z]{2}$/.test(estado)) return { ok: false, erro: "UF deve ter 2 letras (ex.: SP)." };
  const opcional = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    ok: true,
    dados: {
      nomeRazaoSocial: nome,
      telefone,
      documento: documento || undefined,
      tipoPessoa: documento.length === 14 ? "JURIDICA" : "FISICA",
      email: email || undefined,
      cep: soDigitos(r.cep) || undefined,
      logradouro: opcional(r.logradouro),
      numero: opcional(r.numero),
      bairro: opcional(r.bairro),
      cidade: opcional(r.cidade),
      estado: estado || undefined,
      observacoes: opcional(r.observacoes),
    },
  };
}

// ─── Produtos ────────────────────────────────────────────────────────────────

export type CampoProduto = "nome" | "categoria" | "precoVenda" | "custo" | "quantidade" | "estoqueMinimo" | "codigoBarras" | "sku" | "unidade" | "compatibilidade" | "descricao";

export const COLUNAS_PRODUTO: readonly Coluna<CampoProduto>[] = [
  { campo: "nome", titulo: "Nome", apelidos: ["produto", "descricao do produto", "item"], obrigatoria: true, exemplo: "Película 3D iPhone 13" },
  { campo: "categoria", titulo: "Categoria", apelidos: ["grupo", "tipo"], obrigatoria: true, exemplo: "Películas" },
  { campo: "precoVenda", titulo: "Preço de venda", apelidos: ["preco", "preco venda", "valor", "valor de venda", "venda"], obrigatoria: true, exemplo: "39,90" },
  { campo: "custo", titulo: "Custo", apelidos: ["preco de custo", "valor de custo", "compra"], exemplo: "8,50" },
  { campo: "quantidade", titulo: "Quantidade", apelidos: ["estoque", "qtd", "qtde", "saldo", "quantidade em estoque"], exemplo: "10" },
  { campo: "estoqueMinimo", titulo: "Estoque mínimo", apelidos: ["estoque minimo", "minimo"], exemplo: "3" },
  { campo: "codigoBarras", titulo: "Código de barras", apelidos: ["codigo de barras", "ean", "gtin", "codigo barras"], exemplo: "7891234567890" },
  { campo: "sku", titulo: "SKU", apelidos: ["codigo", "codigo interno", "referencia", "ref"], exemplo: "" },
  { campo: "unidade", titulo: "Unidade", apelidos: ["un", "unid"], exemplo: "UN" },
  { campo: "compatibilidade", titulo: "Compatibilidade", apelidos: ["modelos", "compativel com"], exemplo: "iPhone 13, 13 Pro" },
  { campo: "descricao", titulo: "Descrição", apelidos: ["descricao", "detalhes"], exemplo: "" },
];

export type ProdutoImportado = {
  nome: string;
  categoria: string;
  precoVenda: number;
  custo: number;
  quantidadeEstoque: number;
  estoqueMinimo: number;
  codigoBarras?: string;
  sku?: string;
  unidade: string;
  compatibilidade?: string;
  descricao?: string;
};

function lerInteiro(v: string, padrao: number): number | null {
  const t = v.trim();
  if (!t) return padrao;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(n) ? n : null;
}

const UNIDADES = new Set<string>(UNIDADES_DE_MEDIDA.map((u) => u.valor));

export function converterProduto(r: Registro<CampoProduto>): Conversao<ProdutoImportado> {
  const nome = r.nome.replace(/\s+/g, " ").trim();
  if (nome.length < 3) return { ok: false, erro: "Nome com menos de 3 letras." };
  const categoria = r.categoria.replace(/\s+/g, " ").trim();
  if (!categoria) return { ok: false, erro: "Sem categoria." };
  const preco = lerEntradaMonetaria(r.precoVenda);
  if (preco === null || preco < 0) return { ok: false, erro: "Preço de venda inválido." };
  const custo = r.custo.trim() ? lerEntradaMonetaria(r.custo) : 0;
  if (custo === null || custo < 0) return { ok: false, erro: "Custo inválido." };
  const quantidade = lerInteiro(r.quantidade, 0);
  if (quantidade === null || quantidade < 0) return { ok: false, erro: "Quantidade precisa ser um número inteiro." };
  const minimo = lerInteiro(r.estoqueMinimo, 3);
  if (minimo === null || minimo < 0) return { ok: false, erro: "Estoque mínimo precisa ser um número inteiro." };
  const unidade = (r.unidade.trim() || "UN").toUpperCase();
  if (!UNIDADES.has(unidade)) return { ok: false, erro: `Unidade "${r.unidade}" desconhecida (use UN, CX, PCT, PAR, M, KG, L ou SV).` };
  const opcional = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    ok: true,
    dados: {
      nome,
      categoria,
      precoVenda: paraMoeda(preco),
      custo: paraMoeda(custo),
      quantidadeEstoque: quantidade,
      estoqueMinimo: minimo,
      codigoBarras: soDigitos(r.codigoBarras) || undefined,
      sku: opcional(r.sku)?.toUpperCase(),
      unidade,
      compatibilidade: opcional(r.compatibilidade)?.slice(0, 120),
      descricao: opcional(r.descricao),
    },
  };
}
