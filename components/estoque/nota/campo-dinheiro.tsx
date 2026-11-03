"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatarReais, lerReais } from "@/lib/dinheiro";

/**
 * Campo de dinheiro que só confirma o valor quando a pessoa sai dele.
 *
 * Converter a cada tecla é o erro clássico deste controle: quem digita
 * "12,50" passa por "1", "12", "12," — e "12," reinterpretado vira R$ 12,00,
 * que reescreve o campo embaixo do cursor e come o que vinha depois. Aqui o
 * texto é livre enquanto está em foco, e vira centavos no `blur`.
 *
 * Texto que não é valor nenhum volta pro último valor válido, em vez de
 * virar zero: zero é um número, e um frete que virou R$ 0,00 sozinho é pior
 * do que um campo que não aceitou o que foi digitado.
 */
export function CampoDinheiro({
  valorCentavos,
  onChange,
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  valorCentavos: number;
  onChange: (centavos: number) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  /**
   * O que foi digitado, ou `null` quando o campo não está sendo editado.
   *
   * O texto é DERIVADO em vez de sincronizado com um efeito: enquanto há
   * rascunho, ele manda; sem rascunho, o campo mostra o valor de fora,
   * sempre formatado. Guardar uma cópia do valor em estado e reconciliar os
   * dois num `useEffect` é o caminho curto pro campo piscar com o valor
   * antigo entre uma renderização e a seguinte.
   */
  const [rascunho, setRascunho] = useState<string | null>(null);
  const texto = rascunho ?? formatarReais(valorCentavos);

  function confirmar() {
    const digitado = rascunho;
    setRascunho(null);

    if (digitado === null) return;

    try {
      const centavos = lerReais(digitado);
      if (centavos < 0) return;
      onChange(centavos);
    } catch {
      // Texto que não é valor nenhum: o campo volta sozinho pro valor
      // anterior, porque `rascunho` já foi zerado.
    }
  }

  return (
    <Input
      id={id}
      inputMode="decimal"
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      value={texto}
      onFocus={(evento) => evento.target.select()}
      onChange={(evento) => setRascunho(evento.target.value)}
      onBlur={confirmar}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") evento.currentTarget.blur();
        if (evento.key === "Escape") {
          setRascunho(null);
          evento.currentTarget.blur();
        }
      }}
    />
  );
}
