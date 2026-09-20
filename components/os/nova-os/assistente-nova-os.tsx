"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndicadorPassos, type PassoIndicador } from "@/components/ui/indicador-passos";
import { PassoClienteAparelho } from "./passo-cliente-aparelho";
import { PassoEntrada } from "./passo-entrada";
import { PassoOrcamento } from "./passo-orcamento";

const CAMPOS_POR_PASSO: Record<number, string[]> = {
  1: ["clienteId", "imei"],
  2: ["relatoCliente"],
  3: [],
};

const TITULOS: { titulo: string; descricao: string }[] = [
  { titulo: "Cliente e aparelho", descricao: "Quem é e o que trouxe" },
  { titulo: "Entrada", descricao: "Como chegou" },
  { titulo: "Orçamento", descricao: "Opcional agora" },
];

const DICAS: Record<number, string> = {
  1: "Cliente é obrigatório. Marca, modelo e o resto do aparelho são opcionais.",
  2: "O relato do cliente é obrigatório — o resto é opcional.",
  3: "Orçamento é opcional agora — dá pra lançar peças depois, na tela da OS.",
};

interface PropsAssistenteNovaOS {
  onCancelar: () => void;
  /**
   * Dispara o envio do formulário (o wrapper passa `formulario.handleSubmit(handleSalvar)`).
   * O botão de salvar é `type="button"` e chama isso diretamente, em vez de
   * `type="submit"` — ver comentário no botão, abaixo, sobre o bug que isso evita.
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
  const [passoAtual, setPassoAtual] = useState(1);
  const [nomeClienteResumo, setNomeClienteResumo] = useState(clienteNomeInicial ?? "");

  const passos: PassoIndicador[] = TITULOS.map((info, indice) => {
    const numero = indice + 1;
    return {
      numero,
      titulo: info.titulo,
      descricao: info.descricao,
      estado: numero < passoAtual ? "concluido" : numero === passoAtual ? "atual" : "pendente",
    };
  });

  const avancar = async () => {
    const campos = CAMPOS_POR_PASSO[passoAtual] ?? [];
    if (campos.length > 0) {
      const valido = await trigger(campos as never);
      if (!valido) return;
    }
    setPassoAtual((atual) => Math.min(3, atual + 1));
  };

  const voltar = () => setPassoAtual((atual) => Math.max(1, atual - 1));

  const irParaPasso = async (numero: number) => {
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
            <span className="text-xl font-extrabold tracking-tight text-kx-texto">Nova ordem de serviço</span>
            <span className="text-[13px] text-kx-legenda">O número da OS é gerado ao salvar.</span>
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
        <IndicadorPassos passos={passos} onEscolher={irParaPasso} />
      </header>

      <div className="min-h-0 flex-1">
        {passoAtual === 1 && (
          <PassoClienteAparelho
            clienteIdInicial={clienteIdInicial}
            clienteNomeInicial={clienteNomeInicial}
            onClienteSelecionado={setNomeClienteResumo}
          />
        )}
        {passoAtual === 2 && <PassoEntrada />}
        {passoAtual === 3 && (
          <PassoOrcamento nomeClienteResumo={nomeClienteResumo} prazoGarantiaPadraoDias={prazoGarantiaPadraoDias} />
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-kx-painel-borda pt-4">
        <span className="text-xs text-kx-legenda">{DICAS[passoAtual]}</span>
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
          {passoAtual < 3 ? (
            <Button type="button" onClick={avancar} className="h-[44px] rounded-kx-botao px-5 text-sm">
              Continuar
            </Button>
          ) : (
            // type="button" de propósito, não "submit": os dois botões (Continuar e
            // Salvar) ocupam a mesma posição no JSX condicional, e o React reaproveita
            // o mesmo <button> do DOM ao trocar de passo em vez de criar um novo — um
            // "submit" nessa posição corria risco de herdar um clique que era pra
            // avançar de passo, criando uma OS em branco sem o operador clicar em
            // Salvar. Chamar onSalvarClick diretamente evita depender do navegador
            // disparar o submit nativo do formulário.
            <Button type="button" disabled={salvando} onClick={onSalvarClick} className="h-[44px] rounded-kx-botao px-5 text-sm">
              {salvando ? "Salvando..." : "Salvar ordem de serviço"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
