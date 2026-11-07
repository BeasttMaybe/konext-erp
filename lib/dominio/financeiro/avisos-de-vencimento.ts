/**
 * Quais contas merecem aviso hoje, e o que o aviso diz.
 *
 * O dono pediu: notificar três dias antes do vencimento, depois dois, depois
 * um, depois no dia. Quatro toques, para que nenhum boleto vença por
 * esquecimento.
 *
 * ESTE MÓDULO É PURO DE PROPÓSITO. Ele não lê banco, não manda mensagem e não
 * sabe o que é Telegram. Recebe as contas, o dia de hoje e o que já foi
 * avisado, e devolve a lista de avisos. Assim a regra — que é a parte que
 * erra em silêncio e que ninguém percebe errada até perder um vencimento —
 * pode ser testada inteira sem rede e sem banco.
 *
 * O QUE EXISTIA ANTES
 *
 * `/api/cron/verificar-vencimentos` roda todo dia desde sempre, e consultava
 * o model `Conta` — uma tabela legada, com `status` e `tipo` como texto
 * solto, em que NADA no sistema escreve. As contas de verdade vivem em
 * `ParcelaDespesa` e `ContaReceber`. Ou seja: o cron rodava todos os dias,
 * encontrava zero linhas e não avisava nada. O aviso de vencimento nunca
 * funcionou, e não havia como notar — um cron que não acha nada é
 * indistinguível de um cron que não tem nada pra achar.
 */

import { diferencaEntreDatasDeCalendario } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";

/**
 * Quantos dias antes avisar. Quatro toques, do mais longe ao mais perto.
 *
 * Em ordem decrescente porque é a ordem em que acontecem na vida da conta, e
 * porque é a ordem em que os avisos saem quando uma conta nasce atrasada.
 */
export const DIAS_DE_AVISO = [3, 2, 1, 0] as const;

export type DiasDeAviso = (typeof DIAS_DE_AVISO)[number];

export type TipoDeConta = "PAGAR" | "RECEBER";

export type ContaParaAviso = {
  id: string;
  tipo: TipoDeConta;
  /** O que a conta é: "Internet Fibra", "Aluguel", "Serviço OS #412". */
  descricao: string;
  /** Com quem: fornecedor ou cliente. Nulo quando a conta não tem. */
  contraparte: string | null;
  valorCentavos: number;
  dataVencimento: Date;
};

export type AvisoDeVencimento = {
  conta: ContaParaAviso;
  diasDeAntecedencia: DiasDeAviso;
  titulo: string;
  mensagem: string;
};

/**
 * A chave de "já avisei isto".
 *
 * Tipo + id + dias: a mesma conta é avisada quatro vezes, uma por marco, e
 * cada marco só uma vez. É o que impede o cron de repetir o aviso de hoje se
 * ele rodar duas vezes — e crons rodam duas vezes: redeploy, retry da
 * plataforma, alguém abrindo a URL.
 */
export function chaveDoAviso(
  tipo: TipoDeConta,
  contaId: string,
  diasDeAntecedencia: number
): string {
  return `${tipo}:${contaId}:${diasDeAntecedencia}`;
}

function comoOPrazoSeChama(dias: DiasDeAviso): string {
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

function formatarDiaEMes(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

/**
 * Monta o texto que a pessoa lê no celular.
 *
 * Ordem deliberada: primeiro O QUE É (pagar ou receber) e QUANDO, porque é o
 * que decide se vale abrir o app agora; depois com quem e quanto. Quem recebe
 * dez avisos numa manhã lê a primeira linha de cada um e só isso.
 */
function montarMensagem(conta: ContaParaAviso, dias: DiasDeAviso): string {
  const prazo = comoOPrazoSeChama(dias);
  const rotuloDoTipo = conta.tipo === "PAGAR" ? "A pagar" : "A receber";
  const comQuem = conta.contraparte?.trim();

  const primeiraLinha = `${rotuloDoTipo} — ${prazo}`;
  const segundaLinha = comQuem ? `${comQuem}: ${conta.descricao}` : conta.descricao;
  const terceiraLinha = `${formatarReais(conta.valorCentavos)} · ${formatarDiaEMes(conta.dataVencimento)}`;

  return `${primeiraLinha}\n${segundaLinha}\n${terceiraLinha}`;
}

function montarTitulo(conta: ContaParaAviso, dias: DiasDeAviso): string {
  const prazo = dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`;
  return conta.tipo === "PAGAR" ? `Conta a pagar ${prazo}` : `Conta a receber ${prazo}`;
}

/**
 * Os avisos a mandar hoje.
 *
 * Uma conta cujo vencimento já passou NÃO gera aviso. Isso é escolha, não
 * omissão: o aviso existe pra evitar o atraso, e depois que ele aconteceu
 * quem avisa é a tela, que mostra "Atrasado" em vermelho todo dia até alguém
 * resolver. Mandar "venceu há 14 dias" no celular todas as manhãs, pra uma
 * conta que a pessoa já sabe que está atrasada, é o caminho mais curto pra
 * ela silenciar o bot — e aí perder também os avisos que importam.
 *
 * Uma conta cadastrada HOJE vencendo em dois dias recebe só o aviso de dois
 * dias; o de três já passou e não é remontado. Cada marco existe no seu dia
 * ou não existe.
 */
export function montarAvisosDeVencimento({
  contas,
  hoje,
  chavesJaAvisadas,
}: {
  contas: ContaParaAviso[];
  hoje: Date;
  /** Chaves de `chaveDoAviso` já gravadas. */
  chavesJaAvisadas: ReadonlySet<string>;
}): AvisoDeVencimento[] {
  const avisos: AvisoDeVencimento[] = [];

  for (const conta of contas) {
    const diasAteVencer = diferencaEntreDatasDeCalendario(hoje, conta.dataVencimento);

    if (!DIAS_DE_AVISO.includes(diasAteVencer as DiasDeAviso)) continue;

    const dias = diasAteVencer as DiasDeAviso;

    if (chavesJaAvisadas.has(chaveDoAviso(conta.tipo, conta.id, dias))) continue;

    avisos.push({
      conta,
      diasDeAntecedencia: dias,
      titulo: montarTitulo(conta, dias),
      mensagem: montarMensagem(conta, dias),
    });
  }

  // Mais urgente primeiro, e dentro do mesmo dia o que sai antes do que
  // entra: quem abre o celular de manhã quer ver "vence hoje" no topo, e
  // entre dois "vence hoje" o que dói é o que precisa ser pago.
  return avisos.sort((a, b) => {
    if (a.diasDeAntecedencia !== b.diasDeAntecedencia) {
      return a.diasDeAntecedencia - b.diasDeAntecedencia;
    }
    if (a.conta.tipo !== b.conta.tipo) return a.conta.tipo === "PAGAR" ? -1 : 1;
    return b.conta.valorCentavos - a.conta.valorCentavos;
  });
}
