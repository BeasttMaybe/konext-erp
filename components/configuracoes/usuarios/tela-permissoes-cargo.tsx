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
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

type PropsTelaPermissoesCargo = {
  cargoId: string;
  onVoltar: () => void;
};

const COLUNAS: ColunaGradePermissoes[] = ["ver", "criar", "editar", "excluir"];

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
    return <Card className="border-border bg-card p-6 text-sm text-muted-foreground">Carregando permissões...</Card>;
  }

  if (!cargo) {
    return (
      <Card className="border-border bg-card p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Cargo não encontrado.</p>
        <Button type="button" variant="outline" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card p-5 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2" onClick={onVoltar}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para cargos
          </Button>
          <h2 className="text-xl font-semibold text-foreground">Permissões de &quot;{cargo.nome}&quot;</h2>
          <p className="text-sm text-muted-foreground">
            {cargo.quantidadeUsuariosAtivos} {cargo.quantidadeUsuariosAtivos === 1 ? "pessoa usa" : "pessoas usam"} este cargo hoje.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] table-auto border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-3 py-2 font-medium text-foreground">Módulo</th>
              {COLUNAS.map((coluna) => (
                <th key={coluna} className="px-3 py-2 text-center font-medium text-foreground">
                  {ROTULOS_COLUNA_GRADE[coluna]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADE_PERMISSOES.map((linha) => (
              <tr key={linha.chave} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium text-foreground">{linha.rotulo}</td>
                {COLUNAS.map((coluna) => {
                  const permissao = linha.colunas[coluna];
                  if (!permissao) {
                    return (
                      <td key={coluna} className="px-3 py-2 text-center text-muted-foreground">
                        —
                      </td>
                    );
                  }
                  const info = rotulosPorPermissao.get(permissao);
                  return (
                    <td key={coluna} className="px-3 py-2 text-center" title={info?.descricao}>
                      <Checkbox
                        checked={selecionadas.has(permissao)}
                        onCheckedChange={(marcado) => alternar(permissao, Boolean(marcado))}
                        aria-label={info?.rotulo ?? permissao}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Permissões especiais</p>
        <div className="grid gap-3 md:grid-cols-2">
          {PERMISSOES_ESPECIAIS.map((permissao) => {
            const info = rotulosPorPermissao.get(permissao);
            return (
              <label
                key={permissao}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer"
              >
                <Checkbox
                  checked={selecionadas.has(permissao)}
                  onCheckedChange={(marcado) => alternar(permissao, Boolean(marcado))}
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">{info?.rotulo ?? permissao}</span>
                  <span className="block text-xs text-muted-foreground">{info?.descricao}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Escopo de visibilidade</p>
        <p className="text-xs text-muted-foreground">
          Estas três decidem se o cargo enxerga só o que a própria pessoa criou/atende, ou tudo da empresa.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {PERMISSOES_ESCOPO.map((item) => {
            const ligado = selecionadas.has(item.permissao);
            const info = rotulosPorPermissao.get(item.permissao);
            return (
              <div key={item.permissao} className="rounded-lg border border-border bg-background p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">{item.rotulo}</p>
                <div className="flex items-center gap-2">
                  <Switch checked={ligado} onCheckedChange={(marcado) => alternar(item.permissao, marcado)} />
                  <span className="text-xs text-muted-foreground">{ligado ? item.rotuloAtivo : item.rotuloInativo}</span>
                </div>
                {info?.descricao && <p className="text-xs text-muted-foreground">{info.descricao}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onVoltar} disabled={salvando}>
          Cancelar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={salvando}>
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
    </Card>
  );
}
