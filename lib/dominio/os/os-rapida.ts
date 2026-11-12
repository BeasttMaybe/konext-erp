import { paraMoeda } from "@/lib/dinheiro";
import type { TipoPecaOrcamento } from "@/types/os";

/**
 * A abertura de OS pelo celular: uma tela so, na ordem em que o balcao
 * pergunta as coisas ao cliente.
 *
 * Obrigatorios: cliente, aparelho e defeito. Todo o resto (observacao, senha,
 * foto, pre-orcamento) e opcional — quem esta com o aparelho na mao e o
 * cliente na frente precisa conseguir abrir a OS em segundos e completar
 * depois, no computador.
 *
 * As regras ficam aqui, fora do componente, para serem testadas sem tela.
 */

export type ModoDaSenha = "CARACTERES" | "DESENHO";

export type ItemDoPreOrcamento = {
  tipo: TipoPecaOrcamento;
  descricao: string;
  /** Em centavos, como o resto do sistema. */
  valorCentavos: number;
};

export type RascunhoDaOSRapida = {
  clienteId: string | null;
  aparelho: string;
  defeito: string;
  observacoes: string;
  modoDaSenha: ModoDaSenha;
  senha: string;
  /** Pontos de 1 a 9, na ordem tocada. */
  desenho: number[];
  itens: ItemDoPreOrcamento[];
};

export const RASCUNHO_VAZIO: RascunhoDaOSRapida = {
  clienteId: null,
  aparelho: "",
  defeito: "",
  observacoes: "",
  modoDaSenha: "CARACTERES",
  senha: "",
  desenho: [],
  itens: [],
};

export const ROTULOS_TIPO_PECA: Readonly<Record<TipoPecaOrcamento, string>> = {
  TELA: "Tela",
  BATERIA: "Bateria",
  CONECTOR_CARGA: "Conector",
  TAMPA_IPHONE: "Tampa iPhone",
  TAMPA_ANDROID: "Tampa Android",
  OUTROS: "Outro",
};

export type ErrosDaOSRapida = Partial<Record<"cliente" | "aparelho" | "defeito" | "itens", string>>;

/** Um item conta se tem valor; sem descricao, herda o nome do tipo. */
function itemPreenchido(item: ItemDoPreOrcamento) {
  return item.valorCentavos > 0;
}

export function validarOSRapida(rascunho: RascunhoDaOSRapida): ErrosDaOSRapida {
  const erros: ErrosDaOSRapida = {};
  if (!rascunho.clienteId) erros.cliente = "Escolha ou cadastre o cliente.";
  if (!rascunho.aparelho.trim()) erros.aparelho = "Diga qual é o aparelho.";
  if (!rascunho.defeito.trim()) erros.defeito = "Descreva o defeito.";
  // Item com descricao mas sem valor e quase sempre esquecimento: o servidor
  // o descartaria em silencio, e o pre-orcamento sairia menor do que o
  // combinado com o cliente.
  if (rascunho.itens.some((item) => item.descricao.trim() && item.valorCentavos <= 0)) {
    erros.itens = "Há item do pré-orçamento sem valor.";
  }
  return erros;
}

/**
 * O desenho so vale com 4 pontos ou mais — o minimo do Android. Menos que
 * isso e toque acidental, e gravar um desenho invalido seria pior que nenhum:
 * o tecnico tentaria e travaria o aparelho do cliente.
 */
export const MINIMO_DE_PONTOS_DO_DESENHO = 4;

/** Acrescenta o ponto se ainda nao foi tocado (o desenho nao repete ponto). */
export function tocarPontoDoDesenho(desenho: number[], ponto: number): number[] {
  if (ponto < 1 || ponto > 9 || desenho.includes(ponto)) return desenho;
  return [...desenho, ponto];
}

export type DadosDaOSRapida = {
  clienteId: string;
  equipamento: string;
  relatoCliente: string;
  observacoesInternas?: string;
  senha?: string;
  senhaDesenho?: string;
  status: "AGUARDANDO_ORCAMENTO";
  itensOrcamento: Array<{
    tipo: TipoPecaOrcamento;
    descricao: string;
    custoPeca: number;
    valorCobrado: number;
  }>;
};

/**
 * Monta o que `criarOrdemServico` recebe. So a senha do modo escolhido vai:
 * quem digitou caracteres e depois trocou para desenho nao deve gravar as
 * duas. O custo da peca entra zerado — no balcao ninguem sabe ainda; o
 * tecnico preenche ao comprar.
 */
export function montarDadosDaOSRapida(rascunho: RascunhoDaOSRapida): DadosDaOSRapida {
  if (!rascunho.clienteId) throw new Error("OS sem cliente.");
  const observacoes = rascunho.observacoes.trim();
  const senha = rascunho.modoDaSenha === "CARACTERES" ? rascunho.senha.trim() : "";
  const desenho =
    rascunho.modoDaSenha === "DESENHO" && rascunho.desenho.length >= MINIMO_DE_PONTOS_DO_DESENHO
      ? rascunho.desenho.join("-")
      : "";

  return {
    clienteId: rascunho.clienteId,
    equipamento: rascunho.aparelho.trim(),
    relatoCliente: rascunho.defeito.trim(),
    ...(observacoes ? { observacoesInternas: observacoes } : {}),
    ...(senha ? { senha } : {}),
    ...(desenho ? { senhaDesenho: desenho } : {}),
    status: "AGUARDANDO_ORCAMENTO",
    itensOrcamento: rascunho.itens.filter(itemPreenchido).map((item) => ({
      tipo: item.tipo,
      descricao: item.descricao.trim() || ROTULOS_TIPO_PECA[item.tipo],
      custoPeca: 0,
      valorCobrado: paraMoeda(item.valorCentavos),
    })),
  };
}

export function totalDoPreOrcamento(itens: ItemDoPreOrcamento[]): number {
  return itens.reduce((total, item) => total + Math.max(0, item.valorCentavos), 0);
}

/**
 * A abertura rapida e a do celular. A largura e lida no CLIQUE, e nao na
 * renderizacao: o servidor nao sabe a largura da tela, e decidir no render
 * faria o HTML do servidor e o do navegador divergirem.
 */
export const CONSULTA_DE_TELA_DE_CELULAR = "(max-width: 767px)";
