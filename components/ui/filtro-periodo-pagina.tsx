"use client";

/**
 * Ponto de montagem ÚNICO do `FiltroPeriodo` (Fase 2A-1, follow-up "adoção
 * idêntica ao Dashboard"). O dono do projeto confirmou ao vivo que a pill
 * "Personalizado" do Dashboard está 100% correta (dois calendários com papel
 * fixo, navegação independente, presets dentro do painel, tamanho e posição
 * certos) e reportou que as outras 6 adoções ainda se comportavam errado —
 * mesmo usando o MESMO `FiltroPeriodo` por baixo. A causa não era o painel
 * (esse é código 100% compartilhado, nunca configurável por prop de tela) —
 * era a MONTAGEM: cada tela chamava `<FiltroPeriodo>` direto, e cada uma
 * tinha uma pequena variação própria: Suspense presente nalgumas telas e
 * ausente noutras, `rotulo` esquecido em Vendas > Histórico (o gatilho lá
 * não mostrava nome de campo nenhum), `fusoHorario` esquecido no PDV > Caixa,
 * e o gatilho do Dashboard usando uma altura/estilo (h-11, pill transparente)
 * diferente do padrão das outras 6 telas (h-10, botão contornado).
 *
 * Este componente elimina essa variação: é o ÚNICO lugar do app que importa
 * `FiltroPeriodo` diretamente. Toda tela passa por aqui. As duas únicas
 * entradas que fazem sentido variar por tela são DADOS, nunca layout:
 *   - `campos`: quais campos de data esta tela filtra (ex. "Vencimento") —
 *     cada tela tem os seus, não tem como isto ser fixo aqui.
 *   - `aoFiltrar`: o que a tela faz quando o usuário aplica o filtro.
 * Tamanho, posição e variante do painel continuam 100% dentro de
 * `FiltroPeriodo`/`PainelFiltroPeriodo` (não repassados como prop por
 * nenhuma tela, nunca foram) — o que ESTE componente fixa é o que antes
 * vazava pra cada tela decidir sozinha por acidente (Suspense, rótulo,
 * fuso horário, estilo do gatilho).
 *
 * `variante`/`ativo` não são uma porta aberta pra estilização livre — são
 * uma escolha FIXA entre as duas configurações que o dono do projeto já viu
 * e confirmou: "padrao" (botão contornado, todas as telas "de filtro
 * avulso": Financeiro, PDV, OS, Vendas) e "pill" (o chip transparente
 * dentro da barra "Hoje/7 dias/30 dias/Mês" do Dashboard — o único lugar
 * onde o filtro é um item de navegação, não um botão avulso). Nenhuma tela
 * pode passar `className`/`compacto`/qualquer outra coisa — não existe
 * esse parâmetro aqui.
 */
import * as React from "react";

import { FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { calcularPresetEsteMes, type IntervaloPeriodo, type OpcaoCampoPeriodo } from "@/lib/filtro-periodo";
import { cn } from "@/lib/utils";
import { FiltroPeriodo } from "@/components/ui/filtro-periodo";

export interface FiltroPeriodoPaginaProps {
  /**
   * Campo(s) de data que esta tela filtra. Um item só: o rótulo vai direto
   * no gatilho ("Vencimento: dd/mm/aaaa até dd/mm/aaaa"), sem seletor —
   * igual ao que cada tela já fazia via a prop `rotulo` do `FiltroPeriodo`.
   * Mais de um item: aparece o seletor de campo (dropdown), pro caso de uma
   * tela futura com mais de um campo de data pra escolher — nenhuma das 7
   * adoções atuais precisa disso hoje.
   */
  campos: OpcaoCampoPeriodo[];
  /** Fuso horário da loja (`Configuracao.fusoHorario`). Sem isto, cai no fuso padrão — mesma regra do `FiltroPeriodo`. */
  fusoHorario?: string;
  /**
   * Outros search params gravados na MESMA navegação que grava inicio/fim
   * ao clicar "Filtrar" (ex.: a pill do Dashboard grava `periodo=custom`
   * junto — ver `components/dashboard/cabecalho-dashboard.tsx`).
   */
  paramsAdicionais?: Record<string, string>;
  /** Chamado além da atualização da URL, ao clicar "Filtrar". */
  aoFiltrar?: (resultado: { campo: string | undefined; intervalo: IntervaloPeriodo }) => void;
  /**
   * Estilo do GATILHO (nunca do painel — ver comentário do módulo). "padrao"
   * é o default de todo filtro avulso; "pill" é só pro Dashboard, onde o
   * filtro é mais um item da barra de navegação de período.
   */
  variante?: "padrao" | "pill";
  /** Só tem efeito com `variante="pill"`: destaca o chip quando este é o período corrente da tela (ex.: `periodo === "custom"` no Dashboard). */
  ativo?: boolean;
}

/** Só o `variante="pill"` (o chip do Dashboard) precisa de um estilo próprio — ver o comentário grande no topo do arquivo sobre por que isto é uma escolha fixa, não uma porta de customização. */
const CLASSE_GATILHO_PILL = (ativo: boolean) =>
  cn(
    // h-9 pra casar com as pills de preset do Dashboard (densidade 11/2026).
    "h-9 gap-1.5 rounded-kx-botao border-transparent bg-transparent px-3 text-sm font-medium",
    ativo
      ? "bg-kx-primaria/15 text-kx-destaque"
      : "text-kx-legenda hover:bg-transparent hover:text-kx-texto"
  );

export function FiltroPeriodoPagina({
  campos,
  fusoHorario = FUSO_HORARIO_PADRAO,
  paramsAdicionais,
  aoFiltrar,
  variante = "padrao",
  ativo = false,
}: FiltroPeriodoPaginaProps) {
  // Toda tela usava `calcularPresetEsteMes(fusoHorario)` como padrão — sem
  // exceção, nas 7 adoções — então isto deixa de ser algo que cada tela
  // decide (e eventualmente esquece) e vira parte da configuração fixa
  // deste wrapper.
  const intervaloPadrao = React.useMemo(() => calcularPresetEsteMes(fusoHorario), [fusoHorario]);

  // Um campo só: rótulo direto no gatilho, sem seletor — nenhuma das 7
  // adoções atuais precisa do seletor (todas filtram um único campo de
  // data). Repassar `campos` com 1 item pro `FiltroPeriodo` ligaria o
  // seletor de campo E passaria a gravar `?campo=...` na URL à toa.
  const rotulo = campos.length === 1 ? campos[0].rotulo : undefined;
  const camposParaSeletor = campos.length > 1 ? campos : undefined;

  return (
    <FiltroPeriodo
      campos={camposParaSeletor}
      rotulo={rotulo}
      fusoHorario={fusoHorario}
      intervaloPadrao={intervaloPadrao}
      paramsAdicionais={paramsAdicionais}
      aoFiltrar={aoFiltrar}
      className={variante === "pill" ? CLASSE_GATILHO_PILL(ativo) : undefined}
    />
  );
}
