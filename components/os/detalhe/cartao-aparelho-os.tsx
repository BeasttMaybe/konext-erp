"use client";

import { useState } from "react";
import { registrarVisualizacaoSenhaOS } from "@/app/actions/os";

function extrairPontosDesenho(valor: string | null | undefined): number[] {
  if (!valor) return [];
  return valor
    .split(/[^0-9]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 9);
}

type PropsCartaoAparelhoOS = {
  osId: string;
  marca: string | null;
  modelo: string | null;
  imei: string | null;
  senha: string | null;
  senhaDesenho: string | null;
};

/**
 * Aparelho + segurança (referência: docs/design/referencia-os-detalhe.html). Não existe
 * campo de "tipo de aparelho" no schema hoje (ver Parte 4 desta fase — os chips de tipo
 * lá também são só visuais por isso) — a linha "Tipo" fica de fora até essa
 * generalização de domínio chegar numa fase futura.
 */
export function CartaoAparelhoOS({ osId, marca, modelo, imei, senha, senhaDesenho }: PropsCartaoAparelhoOS) {
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const pontosDesenho = extrairPontosDesenho(senhaDesenho);

  const alternarSenha = () => {
    const proximoEstado = !senhaVisivel;
    setSenhaVisivel(proximoEstado);

    if (proximoEstado && senha) {
      // Best-effort, nunca bloqueia a UI — ver comentário em registrarVisualizacaoSenhaOS.
      void registrarVisualizacaoSenhaOS(osId);
    }
  };

  return (
    <div className="p-kx-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel flex flex-col gap-3">
      <span className="text-sm font-bold text-kx-texto">Aparelho</span>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
        <div>
          <dt className="text-xs text-kx-legenda">Marca</dt>
          <dd className="font-semibold text-kx-texto">{marca || "Não informada"}</dd>
        </div>
        <div>
          <dt className="text-xs text-kx-legenda">Modelo</dt>
          <dd className="font-semibold text-kx-texto">{modelo || "Não informado"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-kx-legenda">IMEI / Nº de série</dt>
          <dd className="font-semibold tabular-nums text-kx-texto">{imei || "Não informado"}</dd>
        </div>
      </dl>

      <div className="flex items-center gap-3 rounded-kx-botao bg-kx-superficie px-3.5 py-3">
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-xs text-kx-legenda">Senha do aparelho</span>
          <span className="text-sm font-extrabold tracking-[0.18em] tabular-nums text-kx-texto">
            {senhaVisivel ? senha || "Não informada" : "••••"}
          </span>
        </div>
        {senha && (
          <button
            type="button"
            onClick={alternarSenha}
            aria-pressed={senhaVisivel}
            className="h-[34px] shrink-0 rounded-kx-botao border border-kx-campo-borda px-3 text-xs font-bold text-kx-texto-2 transition-colors hover:bg-kx-cartao"
          >
            {senhaVisivel ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </div>
      {senhaVisivel && senha && <span className="text-[11px] text-kx-alerta">Visualização registrada na auditoria.</span>}

      {pontosDesenho.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-kx-legenda">Senha de desenho</span>
          <div className="grid w-[116px] grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }, (_, indice) => {
              const ponto = indice + 1;
              const ordem = pontosDesenho.indexOf(ponto) + 1;
              const ativo = ordem > 0;

              return (
                <span
                  key={ponto}
                  className={`relative h-5 w-5 rounded-full border-2 ${
                    ativo ? "border-kx-destaque bg-kx-destaque/25" : "border-kx-campo-borda bg-transparent"
                  }`}
                >
                  {ativo && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-kx-primaria text-[8px] font-bold text-primary-foreground">
                      {ordem}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
