"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { Assistente, type PassoDoAssistente } from "@/components/ui/assistente";
import { PassoClienteAparelho } from "./passo-cliente-aparelho";
import { PassoEntrada } from "./passo-entrada";
import { PassoOrcamento } from "./passo-orcamento";

/**
 * Esta tela era o assistente INTEIRO: cabeçalho, trilha de passos,
 * navegação, validação e rodapé, tudo aqui dentro.
 *
 * O dono escolheu o formato em etapas para as outras telas de criação. Copiar
 * esta navegação para cada uma significaria repetir ~160 linhas por tela, e a
 * quinta cópia já não se comportaria como a primeira.
 *
 * Então a casca foi para `components/ui/assistente.tsx` — inclusive o
 * `type="button"` do botão final, que vem de um defeito real daqui. O que
 * ficou é o que é desta tela: quais são os passos, o que cada um mostra e o
 * que precisa estar válido para avançar.
 */

const CAMPOS_POR_PASSO: Record<number, string[]> = {
  1: ["clienteId", "imei"],
  2: ["relatoCliente"],
  3: [],
};

interface PropsAssistenteNovaOS {
  onCancelar: () => void;
  /**
   * Dispara o envio do formulário (o wrapper passa
   * `formulario.handleSubmit(handleSalvar)`).
   */
  onSalvarClick: () => void;
  salvando: boolean;
  clienteIdInicial?: string;
  clienteNomeInicial?: string;
  prazoGarantiaPadraoDias?: number;
  tituloExtra?: React.ReactNode;
}

export function AssistenteNovaOS({
  onCancelar,
  onSalvarClick,
  salvando,
  clienteIdInicial,
  clienteNomeInicial,
  prazoGarantiaPadraoDias = 90,
  tituloExtra,
}: PropsAssistenteNovaOS) {
  const { trigger } = useFormContext();
  const [nomeClienteResumo, setNomeClienteResumo] = useState(clienteNomeInicial ?? "");

  /** Valida só os campos daquele passo, e não o formulário inteiro. */
  const validarPasso = (numero: number) => async () => {
    const campos = CAMPOS_POR_PASSO[numero] ?? [];
    if (campos.length === 0) return true;

    return trigger(campos as never);
  };

  const passos: PassoDoAssistente[] = [
    {
      titulo: "Cliente e aparelho",
      descricao: "Quem é e o que trouxe",
      dica: "Cliente é obrigatório. Marca, modelo e o resto do aparelho são opcionais.",
      validar: validarPasso(1),
      conteudo: (
        <PassoClienteAparelho
          clienteIdInicial={clienteIdInicial}
          clienteNomeInicial={clienteNomeInicial}
          onClienteSelecionado={setNomeClienteResumo}
        />
      ),
    },
    {
      titulo: "Entrada",
      descricao: "Como chegou",
      dica: "O relato do cliente é obrigatório — o resto é opcional.",
      validar: validarPasso(2),
      conteudo: <PassoEntrada />,
    },
    {
      titulo: "Orçamento",
      descricao: "Opcional agora",
      dica: "Orçamento é opcional agora — dá pra lançar peças depois, na tela da OS.",
      conteudo: (
        <PassoOrcamento
          nomeClienteResumo={nomeClienteResumo}
          prazoGarantiaPadraoDias={prazoGarantiaPadraoDias}
        />
      ),
    },
  ];

  return (
    <Assistente
      titulo="Nova ordem de serviço"
      subtitulo="O número da OS é gerado ao salvar."
      tituloExtra={tituloExtra}
      passos={passos}
      rotuloConcluir="Salvar ordem de serviço"
      onCancelar={onCancelar}
      onConcluir={onSalvarClick}
      concluindo={salvando}
    />
  );
}
