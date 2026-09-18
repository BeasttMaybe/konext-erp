"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalTecnicosOS } from "@/components/os/modal-tecnicos-os";
import type { TecnicoDaOS } from "@/types/os";

type PropsSecaoTecnicosOS = {
  osId: string;
  numeroOs: string;
  tecnicos: TecnicoDaOS[];
  /** Permissao os.editar do usuario logado — ausente esconde a acao de editar, nunca so desabilita (Fase 1D-2, Parte 4). */
  podeEditar: boolean;
};

export function SecaoTecnicosOS({ osId, numeroOs, tecnicos, podeEditar }: PropsSecaoTecnicosOS) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);

  if (tecnicos.length === 0 && !podeEditar) {
    return null;
  }

  return (
    <Card className="border-border bg-white dark:bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Técnicos
        </h2>
        {podeEditar && (
          <Button type="button" variant="outline" size="sm" onClick={() => setModalAberto(true)}>
            {tecnicos.length > 0 ? "Editar" : "Atribuir"}
          </Button>
        )}
      </div>

      {tecnicos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum técnico atribuído a esta OS.</p>
      ) : (
        <ul className="space-y-2">
          {tecnicos.map((tecnico) => (
            <li key={tecnico.usuarioId} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-100">{tecnico.nome}</span>
              <div className="flex items-center gap-2">
                {tecnico.principal && (
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    Principal
                  </Badge>
                )}
                <span className="text-muted-foreground">{tecnico.participacaoPercentual.toFixed(0)}%</span>
              </div>
            </li>
          ))}
        </ul>
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
    </Card>
  );
}
