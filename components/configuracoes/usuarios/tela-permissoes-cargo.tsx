"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { definirPermissoesDoCargo, listarCargos, listarPermissoesDisponiveis, type CargoListado } from "@/app/actions/cargos";
import type { Permissao, PermissaoDisponivel } from "@/lib/auth/permissoes";
import { GRADE_PERMISSOES, PERMISSOES_ESCOPO, PERMISSOES_ESPECIAIS, ROTULOS_COLUNA_GRADE, type ColunaGradePermissoes } from "@/lib/auth/grade-permissoes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type PropsTelaPermissoesCargo = {
  cargoId: string;
  onVoltar: () => void;
};

const COLUNAS: ColunaGradePermissoes[] = ["ver", "criar", "editar", "excluir"];

/**
 * Permissões do cargo (Fase 3-2E, Parte 4) — referência: referencia-
 * configuracoes-permissoes.html. "Renomear"/"Excluir cargo" aparecem na
 * referência mas não têm ação nenhuma ligada na UI hoje (renomearCargo/
 * arquivarCargo existem em app/actions/cargos.ts, mas nenhum componente os
 * chama) — não foram inventados aqui; só "Voltar", que já existia.
 */
export function TelaPermissoesCargo({ cargoId, onVoltar }: PropsTelaPermissoesCargo) {
  const [cargo, setCargo] = useState<CargoListado | null>(null);
  const [catalogo, setCatalogo] = useState<PermissaoDisponivel[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<Permissao>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([listarCargos(), listarPermissoesDisponiveis()]).then(([resultadoCargos, resultadoCatalogo]) => {
      if (resultadoCargos.sucesso) {
        const alvo = resultadoCargos.dados.find((item) => item.id === cargoId) ?? null;
        setCargo(alvo);
        setSelecionadas(new Set(alvo?.permissoes ?? []));
      } else {
        toast.error(resultadoCargos.erro);
      }
      if (resultadoCatalogo.sucesso) {
        setCatalogo(resultadoCatalogo.dados);
      } else {
        toast.error(resultadoCatalogo.erro);
      }
      setCarregando(false);
    });
  }, [cargoId]);

  const rotulosPorPermissao = useMemo(
    () => new Map(catalogo.map((item) => [item.permissao, item])),
    [catalogo]
  );

  const alternar = (permissao: Permissao, ligado: boolean) => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (ligado) proximo.add(permissao);
      else proximo.delete(permissao);
      return proximo;
    });
  };

  const aoSalvar = async () => {
    if (!cargo) return;
    setSalvando(true);
    try {
      const resultado = await definirPermissoesDoCargo({
        cargoId: cargo.id,
        permissoes: Array.from(selecionadas),
      });
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Permissões salvas. Valem a partir da próxima ação de cada usuário — sem precisar logar de novo.");
      onVoltar();
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6 text-sm text-kx-legenda">
        Carregando permissões...
      </div>
    );
  }

  if (!cargo) {
    return (
      <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-6">
        <p className="text-sm text-kx-legenda">Cargo não encontrado.</p>
        <Button type="button" variant="outline" className="w-fit rounded-kx-botao" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para cargos
        </Button>
        <div>
          <h2 className="text-lg font-extrabold text-kx-texto">Permissões de &quot;{cargo.nome}&quot;</h2>
          <p className="text-sm text-kx-legenda">
            {cargo.quantidadeUsuariosAtivos} {cargo.quantidadeUsuariosAtivos === 1 ? "pessoa usa" : "pessoas usam"} este cargo hoje.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <div className="hidden grid-cols-[minmax(0,1fr)_74px_74px_74px_74px] gap-2 px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-kx-legenda sm:grid">
          <span>Módulo</span>
          {COLUNAS.map((coluna) => (
            <span key={coluna} className="text-center">
              {ROTULOS_COLUNA_GRADE[coluna]}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          {GRADE_PERMISSOES.map((linha) => (
            <div
              key={linha.chave}
              className="grid grid-cols-2 gap-2 rounded-kx-botao bg-kx-superficie px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_74px_74px_74px_74px] sm:items-center"
            >
              <span className="col-span-2 text-sm font-bold text-kx-texto sm:col-span-1">{linha.rotulo}</span>
              {COLUNAS.map((coluna) => {
                const permissao = linha.colunas[coluna];
                if (!permissao) {
                  return (
                    <span key={coluna} className="flex justify-center text-kx-legenda">
                      —
                    </span>
                  );
                }
                const info = rotulosPorPermissao.get(permissao);
                return (
                  <span key={coluna} className="flex items-center justify-center gap-1.5" title={info?.descricao}>
                    <span className="text-[11px] text-kx-legenda sm:hidden">{ROTULOS_COLUNA_GRADE[coluna]}</span>
                    <Switch
                      checked={selecionadas.has(permissao)}
                      onCheckedChange={(marcado) => alternar(permissao, Boolean(marcado))}
                      aria-label={info?.rotulo ?? permissao}
                    />
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <p className="text-sm font-bold text-kx-texto">Permissões especiais</p>
        <div className="grid gap-2 md:grid-cols-2">
          {PERMISSOES_ESPECIAIS.map((permissao) => {
            const info = rotulosPorPermissao.get(permissao);
            const ligado = selecionadas.has(permissao);
            return (
              <div key={permissao} className="flex items-center gap-3 rounded-kx-botao bg-kx-superficie p-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[13px] font-bold text-kx-texto">{info?.rotulo ?? permissao}</p>
                  <p className="text-[11px] text-kx-legenda">{info?.descricao}</p>
                </div>
                <Switch
                  checked={ligado}
                  onCheckedChange={(marcado) => alternar(permissao, Boolean(marcado))}
                  aria-label={info?.rotulo ?? permissao}
                  className="shrink-0"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <div>
          <p className="text-sm font-bold text-kx-texto">Escopo de visibilidade</p>
          <p className="text-xs text-kx-legenda">
            Estas três decidem se o cargo enxerga só o que a própria pessoa criou/atende, ou tudo da empresa.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {PERMISSOES_ESCOPO.map((item) => {
            const ligado = selecionadas.has(item.permissao);
            const info = rotulosPorPermissao.get(item.permissao);
            return (
              <div key={item.permissao} className="flex flex-col gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3.5">
                <p className="text-sm font-bold text-kx-texto">{item.rotulo}</p>
                <div className="flex items-center gap-2">
                  <Switch checked={ligado} onCheckedChange={(marcado) => alternar(item.permissao, marcado)} />
                  <span className={`text-xs font-semibold ${ligado ? "text-kx-sucesso-texto" : "text-kx-legenda"}`}>
                    {ligado ? item.rotuloAtivo : item.rotuloInativo}
                  </span>
                </div>
                {info?.descricao && <p className="text-xs text-kx-legenda">{info.descricao}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pb-1">
        <Button type="button" variant="ghost" onClick={onVoltar} disabled={salvando}>
          Cancelar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" className="rounded-kx-botao" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar permissões"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Salvar permissões de &quot;{cargo.nome}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso afeta {cargo.quantidadeUsuariosAtivos}{" "}
                {cargo.quantidadeUsuariosAtivos === 1 ? "pessoa que usa" : "pessoas que usam"} este cargo hoje. A
                mudança vale a partir da próxima ação de cada uma — ninguém precisa logar de novo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void aoSalvar()}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
