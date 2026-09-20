"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalTecnicosOS } from "@/components/os/modal-tecnicos-os";
import { iniciais } from "@/components/os/resumo-tecnicos-os";
import type { TecnicoDaOS } from "@/types/os";

type PropsSecaoTecnicosOS = {
  osId: string;
  numeroOs: string;
  tecnicos: TecnicoDaOS[];
  /** Permissao os.editar do usuario logado — ausente esconde a acao de editar, nunca so desabilita (Fase 1D-2, Parte 4). */
  podeEditar: boolean;
};

/**
 * Cor do avatar por posição — mesmo papel visual do --kx-* que a "cor" fictícia da
 * referência, sem token novo. --kx-garantia fica de fora: texto --kx-fundo em cima
 * dela não fecha AA (3.46:1 escuro, 4.40:1 claro — auditado com
 * scripts/dev/auditar-contraste.mjs), só AA-large, e as iniciais são pequenas demais
 * pra contar como texto grande.
 */
const CORES_AVATAR = ["bg-kx-conserto", "bg-kx-sucesso", "bg-kx-alerta", "bg-kx-entregue", "bg-kx-erro"];

export function SecaoTecnicosOS({ osId, numeroOs, tecnicos, podeEditar }: PropsSecaoTecnicosOS) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);

  if (tecnicos.length === 0 && !podeEditar) {
    return null;
  }

  return (
    <div className="p-kx-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-2 text-sm font-bold text-kx-texto">
          <Users className="h-4 w-4" aria-hidden="true" />
          Técnicos
        </span>
        {podeEditar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-[34px] text-xs"
            onClick={() => setModalAberto(true)}
          >
            {tecnicos.length > 0 ? "Editar" : "Atribuir"}
          </Button>
        )}
      </div>

      {tecnicos.length === 0 ? (
        <p className="text-sm text-kx-legenda">Nenhum técnico atribuído a esta OS.</p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {tecnicos.map((tecnico, indice) => (
            <div
              key={tecnico.usuarioId}
              className="flex items-center gap-2.5 rounded-kx-botao bg-kx-cartao py-2 pl-2 pr-3.5"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-kx-fundo ${
                  CORES_AVATAR[indice % CORES_AVATAR.length]
                }`}
              >
                {iniciais(tecnico.nome)}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-kx-texto">{tecnico.nome}</span>
                <span className="text-xs tabular-nums text-kx-legenda">
                  {tecnico.principal ? "Principal" : "Apoio"} · {tecnico.participacaoPercentual.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {podeEditar && (
        <ModalTecnicosOS
          key={modalAberto ? "aberto" : "fechado"}
          aberta={modalAberto}
          onAbrirMudar={setModalAberto}
          osId={osId}
          numeroOs={numeroOs}
          tecnicosAtuais={tecnicos}
          onSalvo={() => router.refresh()}
        />
      )}
    </div>
  );
}
