"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { criarMarcaPeca } from "@/app/actions/marcas-peca";
import { TAMANHO_MAXIMO_NOME_MARCA } from "@/lib/dominio/os/marcas-peca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MarcaDisponivel = { id: string; nome: string };

type PropsCampoMarcaPeca = {
  idCampo: string;
  marcas: MarcaDisponivel[];
  valor: string | null;
  onChange: (marcaPecaId: string | null) => void;
  /** `false` em itens do tipo OUTROS, por onde mão de obra é lançada. */
  exigida: boolean;
  desabilitado?: boolean;
  /**
   * Marca do item que está sendo editado. Entra na lista mesmo se tiver sido
   * desativada depois — senão, abrir um item antigo para corrigir o valor
   * apagaria silenciosamente a marca que ele já tinha.
   */
  marcaAtual?: MarcaDisponivel | null;
};

/**
 * Seletor de marca da peça, com cadastro na hora.
 *
 * O cadastro inline existe por necessidade, não por conveniência: a marca é
 * obrigatória, e `/configuracoes` é bloqueado para GESTOR e USUARIO. Sem poder
 * criar daqui, o técnico com uma marca nova na mão não teria como concluir o
 * lançamento — campo obrigatório sem saída é pior que vocabulário um pouco mais
 * solto, ainda mais porque a chave normalizada já impede o caso ruim de verdade,
 * que é a mesma marca entrar escrita de três jeitos.
 */
export function CampoMarcaPeca({
  idCampo,
  marcas,
  valor,
  onChange,
  exigida,
  desabilitado = false,
  marcaAtual = null,
}: PropsCampoMarcaPeca) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [salvando, iniciarSalvamento] = useTransition();
  // Mantidas aqui até o `router.refresh()` trazer a lista nova do servidor; sem
  // isso o seletor ficaria em branco logo depois de criar a marca.
  const [criadasAgora, setCriadasAgora] = useState<MarcaDisponivel[]>([]);

  const opcoes = useMemo(() => {
    const porId = new Map<string, MarcaDisponivel>();
    for (const marca of marcas) porId.set(marca.id, marca);
    for (const marca of criadasAgora) porId.set(marca.id, marca);
    if (marcaAtual) porId.set(marcaAtual.id, marcaAtual);

    return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [marcas, criadasAgora, marcaAtual]);

  const aoCriar = () => {
    if (!nomeNovo.trim()) return;

    iniciarSalvamento(async () => {
      const resultado = await criarMarcaPeca(nomeNovo);

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      setCriadasAgora((atual) => [...atual, resultado.marca]);
      onChange(resultado.marca.id);
      setNomeNovo("");
      setCriando(false);
      toast.success(resultado.mensagem);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={idCampo}>Marca da peça{exigida ? "" : " (opcional)"}</Label>

      {criando ? (
        <div className="flex items-start gap-2">
          <Input
            id={idCampo}
            value={nomeNovo}
            onChange={(evento) => setNomeNovo(evento.target.value)}
            onKeyDown={(evento) => {
              // O campo vive dentro do formulário do item: Enter aqui
              // enviaria o item inteiro antes da marca existir.
              if (evento.key === "Enter") {
                evento.preventDefault();
                aoCriar();
              }
              if (evento.key === "Escape") {
                evento.preventDefault();
                setCriando(false);
              }
            }}
            maxLength={TAMANHO_MAXIMO_NOME_MARCA}
            placeholder="Nome da nova marca"
            disabled={salvando}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={aoCriar}
            disabled={salvando || nomeNovo.trim().length === 0}
            className="h-9 shrink-0 rounded-kx-botao"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Salvar
          </Button>
          <button
            type="button"
            onClick={() => setCriando(false)}
            disabled={salvando}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-kx-botao border border-kx-campo-borda text-kx-legenda"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Cancelar nova marca</span>
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <Select
            value={valor ?? ""}
            onValueChange={(novo) => onChange(novo || null)}
            disabled={desabilitado || opcoes.length === 0}
          >
            <SelectTrigger id={idCampo} className="flex-1">
              <SelectValue placeholder={opcoes.length === 0 ? "Nenhuma marca cadastrada" : "Selecione a marca"} />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((marca) => (
                <SelectItem key={marca.id} value={marca.id}>
                  {marca.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setCriando(true)}
            disabled={desabilitado}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-kx-botao border border-kx-campo-borda px-3 text-xs font-semibold text-kx-texto-2 hover:bg-kx-superficie"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova
          </button>
        </div>
      )}
    </div>
  );
}
