"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IndicadorPassos, type PassoIndicador } from "@/components/ui/indicador-passos";

/**
 * A casca de um cadastro em etapas: cabeçalho, trilha de passos, corpo e
 * rodapé com Voltar / Continuar / Concluir.
 *
 * POR QUE ISTO EXISTE
 *
 * O dono escolheu o assistente em etapas como formato das telas de criação
 * mais longas — "como a de nova OS, que já uso". A de nova OS existia e
 * funcionava; copiá-la para cada tela nova significaria repetir ~160 linhas
 * de navegação por tela, e a quinta cópia já não se comportaria como a
 * primeira.
 *
 * Então a casca saiu de lá para cá. O que cada tela traz é o CONTEÚDO de
 * cada passo e, opcionalmente, como validar antes de avançar. A navegação,
 * a trilha, os botões e os detalhes abaixo são de todas.
 *
 * AGNÓSTICO DE BIBLIOTECA DE FORMULÁRIO, de propósito
 *
 * A OS usa react-hook-form; o modal de meta usa `useState` puro. Em vez de
 * amarrar a casca a uma das duas, cada passo traz seu próprio `validar()`.
 * Amarrar obrigaria a converter a tela de meta inteira só para ganhar
 * etapas, e trocar duas coisas ao mesmo tempo é como se perde a noção de
 * qual delas quebrou.
 */

export type PassoDoAssistente = {
  titulo: string;
  /** Uma linha, mostrada na trilha. */
  descricao: string;
  /** Uma linha no rodapé dizendo o que é obrigatório aqui. */
  dica?: string;
  conteudo: ReactNode;
  /**
   * Roda antes de sair deste passo; `false` segura a pessoa aqui.
   *
   * Validar passo a passo, e não só no fim, é metade do ponto do assistente:
   * errar o campo três telas atrás e descobrir no botão de salvar é pior que
   * não ter etapa nenhuma.
   */
  validar?: () => boolean | Promise<boolean>;
};

type PropsAssistente = {
  titulo: string;
  subtitulo?: string;
  /** Conteúdo extra no cabeçalho (um aviso, um resumo). */
  tituloExtra?: ReactNode;
  passos: PassoDoAssistente[];
  /** O texto do botão final, p.ex. "Salvar ordem de serviço". */
  rotuloConcluir: string;
  onCancelar: () => void;
  onConcluir: () => void;
  concluindo?: boolean;
  /** Texto do botão final enquanto grava. */
  rotuloConcluindo?: string;
};

export function Assistente({
  titulo,
  subtitulo,
  tituloExtra,
  passos,
  rotuloConcluir,
  onCancelar,
  onConcluir,
  concluindo = false,
  rotuloConcluindo = "Salvando...",
}: PropsAssistente) {
  const [passoAtual, setPassoAtual] = useState(1);

  const total = passos.length;
  const passo = passos[passoAtual - 1];

  const trilha: PassoIndicador[] = passos.map((info, indice) => {
    const numero = indice + 1;
    return {
      numero,
      titulo: info.titulo,
      descricao: info.descricao,
      estado: numero < passoAtual ? "concluido" : numero === passoAtual ? "atual" : "pendente",
    };
  });

  const avancar = async () => {
    const valido = (await passo?.validar?.()) ?? true;
    if (!valido) return;

    setPassoAtual((atual) => Math.min(total, atual + 1));
  };

  const voltar = () => setPassoAtual((atual) => Math.max(1, atual - 1));

  const irParaPasso = async (numero: number) => {
    // Voltar é livre; avançar pela trilha passa pela mesma validação do
    // botão, senão a trilha vira um atalho para pular campo obrigatório.
    if (numero <= passoAtual) {
      setPassoAtual(numero);
      return;
    }

    await avancar();
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xl font-extrabold tracking-tight text-kx-texto">{titulo}</span>
            {subtitulo && <span className="text-[13px] text-kx-legenda">{subtitulo}</span>}
            {tituloExtra}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Cancelar"
            onClick={onCancelar}
            className="ml-auto h-[38px] w-[38px] shrink-0 rounded-kx-botao border-kx-campo-borda text-kx-texto-2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <IndicadorPassos passos={trilha} onEscolher={irParaPasso} />
      </header>

      <div className="min-h-0 flex-1">{passo?.conteudo}</div>

      <footer className="flex items-center gap-3 border-t border-kx-painel-borda pt-4">
        <span className="text-xs text-kx-legenda">{passo?.dica}</span>
        <div className="ml-auto flex gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-[44px] rounded-kx-botao border-kx-campo-borda px-4 text-sm"
            onClick={onCancelar}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={passoAtual === 1}
            onClick={voltar}
            className="h-[44px] rounded-kx-botao border-kx-campo-borda px-4 text-sm disabled:opacity-40"
          >
            Voltar
          </Button>
          {passoAtual < total ? (
            <Button type="button" onClick={avancar} className="h-[44px] rounded-kx-botao px-5 text-sm">
              Continuar
            </Button>
          ) : (
            // `type="button"` de propósito, não "submit" — e isto veio de um
            // defeito real na tela de nova OS:
            //
            // "Continuar" e o botão final ocupam a MESMA posição no JSX
            // condicional, então o React reaproveita o mesmo <button> do DOM
            // ao trocar de passo em vez de criar outro. Um "submit" nessa
            // posição corre o risco de herdar um clique que era para avançar
            // de passo — e gravar um cadastro em branco sem ninguém ter
            // clicado em salvar.
            //
            // Chamar `onConcluir` direto não depende do submit nativo do
            // formulário, e por isso não tem como herdar clique nenhum.
            <Button
              type="button"
              disabled={concluindo}
              onClick={onConcluir}
              className="h-[44px] rounded-kx-botao px-5 text-sm"
            >
              {concluindo ? rotuloConcluindo : rotuloConcluir}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
