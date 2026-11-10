"use client";

import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { listarCandidatosTecnicosOS, definirTecnicosOS } from "@/app/actions/tecnicos-os";
import type { TecnicoDaOS } from "@/types/os";

type SelecaoTecnico = {
  usuarioId: string;
  nome: string;
  participacaoPercentual: number;
};

type PropsModalTecnicosOS = {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  osId: string;
  numeroOs: string;
  tecnicosAtuais: TecnicoDaOS[];
  onSalvo?: () => void;
};

/**
 * Atribuicao de tecnicos de uma OS (Fase 1D-2). Um tecnico e um clique
 * (marca a caixa, participacao vira 100% automatico). Os campos de
 * participacao so aparecem com mais de um marcado.
 */
export function ModalTecnicosOS({
  aberta,
  onAbrirMudar,
  osId,
  numeroOs,
  tecnicosAtuais,
  onSalvo,
}: PropsModalTecnicosOS) {
  // Estado inicial vem direto das props (lazy initializer), sem efeito: quem
  // usa este componente remonta com um `key` que muda a cada abertura (ver
  // cartao-os.tsx/secao-tecnicos-os.tsx), entao cada abertura ja nasce com o
  // estado certo.
  const [candidatos, setCandidatos] = useState<Array<{ id: string; nome: string; email: string }>>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(true);
  const [erroCandidatos, setErroCandidatos] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<SelecaoTecnico[]>(() =>
    tecnicosAtuais.map((tecnico) => ({
      usuarioId: tecnico.usuarioId,
      nome: tecnico.nome,
      participacaoPercentual: tecnico.participacaoPercentual,
    }))
  );
  const [principalId, setPrincipalId] = useState<string | null>(
    () => tecnicosAtuais.find((tecnico) => tecnico.principal)?.usuarioId ?? null
  );
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    void listarCandidatosTecnicosOS().then((resultado) => {
      if (cancelado) return;
      setCarregandoCandidatos(false);

      if (!resultado.sucesso) {
        setErroCandidatos(resultado.erro);
        return;
      }
      setCandidatos(resultado.dados);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const mostrarParticipacao = selecionados.length > 1;

  const somaParticipacao = useMemo(
    () => selecionados.reduce((total, tecnico) => total + (tecnico.participacaoPercentual || 0), 0),
    [selecionados]
  );

  const alternarCandidato = (candidato: { id: string; nome: string }, marcado: boolean) => {
    setSelecionados((atual) => {
      if (marcado) {
        const divisaoIgual = 100 / (atual.length + 1);
        const proximos = [
          ...atual.map((tecnico) => ({ ...tecnico, participacaoPercentual: divisaoIgual })),
          { usuarioId: candidato.id, nome: candidato.nome, participacaoPercentual: divisaoIgual },
        ];
        return proximos;
      }

      const restantes = atual.filter((tecnico) => tecnico.usuarioId !== candidato.id);
      if (restantes.length === 1) {
        return [{ ...restantes[0], participacaoPercentual: 100 }];
      }
      return restantes;
    });

    if (principalId === candidato.id && !marcado) {
      setPrincipalId(null);
    }
  };

  const alterarParticipacao = (usuarioId: string, valorTexto: string) => {
    const valor = paraMoeda(lerEntradaMonetaria(valorTexto) ?? NaN);
    setSelecionados((atual) =>
      atual.map((tecnico) =>
        tecnico.usuarioId === usuarioId
          ? { ...tecnico, participacaoPercentual: Number.isFinite(valor) ? valor : 0 }
          : tecnico
      )
    );
  };

  const salvar = async () => {
    if (mostrarParticipacao && Math.abs(somaParticipacao - 100) > 0.01) {
      toast.error(`A soma das participações precisa ser 100% — está em ${somaParticipacao.toFixed(2)}%.`);
      return;
    }

    setSalvando(true);
    try {
      const resultado = await definirTecnicosOS({
        osId,
        tecnicos: selecionados.map((tecnico) => ({
          usuarioId: tecnico.usuarioId,
          participacaoPercentual: mostrarParticipacao ? tecnico.participacaoPercentual : undefined,
          principal: selecionados.length > 0 ? tecnico.usuarioId === (principalId ?? selecionados[0].usuarioId) : undefined,
        })),
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(`Técnicos da OS ${numeroOs} atualizados.`);
      onSalvo?.();
      onAbrirMudar(false);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar os técnicos.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={onAbrirMudar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Técnicos da OS {numeroOs}</DialogTitle>
          <DialogDescription>
            Marque quem participa desta OS. Com mais de um técnico, informe a participação de cada um e escolha o
            principal.
          </DialogDescription>
        </DialogHeader>

        {erroCandidatos ? (
          <p className="text-sm text-destructive">{erroCandidatos}</p>
        ) : carregandoCandidatos ? (
          <p className="text-sm text-muted-foreground">Carregando técnicos disponíveis...</p>
        ) : candidatos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário com permissão para editar OS está disponível.</p>
        ) : (
          <div className="space-y-3">
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {candidatos.map((candidato) => {
                const marcado = selecionados.some((tecnico) => tecnico.usuarioId === candidato.id);
                const selecao = selecionados.find((tecnico) => tecnico.usuarioId === candidato.id);

                return (
                  <div
                    key={candidato.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5"
                  >
                    <label className="flex flex-1 items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(valor) => alternarCandidato(candidato, Boolean(valor))}
                      />
                      <span className="text-sm font-medium text-foreground">{candidato.nome}</span>
                    </label>

                    {mostrarParticipacao && marcado && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={selecao ? String(selecao.participacaoPercentual) : ""}
                          onChange={(evento) => alterarParticipacao(candidato.id, evento.target.value)}
                          className="h-8 w-16 text-right"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {mostrarParticipacao && (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Soma das participações: <span className="font-medium text-foreground">{somaParticipacao.toFixed(2)}%</span>
                </p>
                <div className="space-y-1">
                  <Label className="text-xs">Técnico principal</Label>
                  <RadioGroup value={principalId ?? undefined} onValueChange={setPrincipalId}>
                    {selecionados.map((tecnico) => (
                      <div key={tecnico.usuarioId} className="flex items-center gap-2">
                        <RadioGroupItem value={tecnico.usuarioId} id={`principal-${tecnico.usuarioId}`} />
                        <Label htmlFor={`principal-${tecnico.usuarioId}`} className="cursor-pointer text-sm font-normal">
                          {tecnico.nome}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onAbrirMudar(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar técnicos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
