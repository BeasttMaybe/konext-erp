/**
 * Traduz uma meta já salva de volta para os campos do formulário.
 *
 * Existe porque o modal de meta é o MESMO para criar e editar (ver
 * `components/metas/modal-nova-meta.tsx`), e o formulário fala numa língua
 * diferente do banco: datas em `DD/MM/AAAA` porque é assim que o campo
 * aceita, valor alvo como texto porque é o que um `<input>` guarda, e enum
 * vazio (`""`) para "não escolhido" porque `<Select>` não tem `null`.
 *
 * Esta conversão num lugar só, e não dentro da página, porque errar aqui é
 * silencioso: um campo que volta vazio por descuido não dá erro nenhum —
 * apenas apaga o que estava salvo quando a pessoa clica em salvar.
 */

import type { MetaParaEditar } from "@/components/metas/modal-nova-meta";

/** Só o que esta conversão precisa, para não amarrar no tipo todo da lista. */
export type MetaSalva = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: MetaParaEditar["categoria"];
  tipoValor: MetaParaEditar["tipoValor"];
  valorAlvo: number | null;
  unidade: string | null;
  /** ISO, como as actions serializam. */
  dataInicio: string | null;
  dataPrazo: string | null;
  prioridade: MetaParaEditar["prioridade"];
  origemProgresso: MetaParaEditar["origemProgresso"];
  fonteAutomatica: MetaParaEditar["fonteAutomatica"] | null;
  metricaAutomatica: MetaParaEditar["metricaAutomatica"] | null;
  direcao: MetaParaEditar["direcao"];
  configuracaoAutomatica: { dataInicio?: string; dataFim?: string; produtoId?: string } | null;
};

/**
 * ISO (ou data de calendário em UTC) para `DD/MM/AAAA`.
 *
 * Fatia a string em vez de usar `toLocaleDateString`: as datas deste projeto
 * são de calendário, ancoradas à meia-noite UTC, e converter para o fuso de
 * quem está olhando empurraria o dia 1º para o dia 30 do mês anterior em
 * qualquer fuso a oeste de Greenwich — o Brasil inteiro.
 */
export function paraCampoDeDataBR(iso: string | null | undefined): string {
  if (!iso) return "";

  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return "";

  return `${dia}/${mes}/${ano}`;
}

export function metaParaFormulario(meta: MetaSalva): MetaParaEditar {
  return {
    id: meta.id,
    titulo: meta.titulo,
    descricao: meta.descricao ?? "",
    categoria: meta.categoria,
    tipoValor: meta.tipoValor,
    // `String(0)` é `"0"`, que é um alvo legítimo — então o teste é contra
    // `null`, e não contra o valor ser falsy.
    valorAlvo: meta.valorAlvo === null ? "" : String(meta.valorAlvo),
    unidade: meta.unidade ?? "",
    dataInicio: paraCampoDeDataBR(meta.dataInicio),
    dataPrazo: paraCampoDeDataBR(meta.dataPrazo),
    prioridade: meta.prioridade,
    origemProgresso: meta.origemProgresso,
    fonteAutomatica: meta.fonteAutomatica ?? "",
    metricaAutomatica: meta.metricaAutomatica ?? "",
    direcao: meta.direcao,
    dataInicioAutomatica: paraCampoDeDataBR(meta.configuracaoAutomatica?.dataInicio),
    dataFimAutomatica: paraCampoDeDataBR(meta.configuracaoAutomatica?.dataFim),
    produtoIdAutomatica: meta.configuracaoAutomatica?.produtoId ?? "",
  };
}
