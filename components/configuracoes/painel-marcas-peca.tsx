"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  criarMarcaPeca,
  definirSituacaoMarcaPeca,
  renomearMarcaPeca,
  type MarcaPecaListada,
} from "@/app/actions/marcas-peca";
import { TAMANHO_MAXIMO_NOME_MARCA } from "@/lib/dominio/os/marcas-peca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SecaoConfiguracoes } from "./secao-configuracoes";

/**
 * Cadastro de marcas de peça.
 *
 * Fica em Configurações, e não no Estoque, porque peça de conserto não é item
 * de estoque neste negócio — é custo direto da OS. Misturar as duas coisas na
 * mesma tela desfaria justamente a separação que o módulo tem.
 *
 * A lista chega pronta do servidor (`app/(dashboard)/configuracoes/page.tsx`) e
 * se atualiza por `router.refresh()`, apoiada no `revalidatePath` que cada ação
 * já faz. Buscar no cliente dentro de um efeito renderizaria a tela vazia
 * primeiro e exigiria `setState` dentro do efeito — a cascata de render que o
 * lint deste projeto proíbe.
 *
 * Cuidado estrutural: este painel vive dentro do `<form>` de Configurações, que
 * tem o próprio botão de salvar. Por isso todo botão aqui é `type="button"` e o
 * Enter dos campos é interceptado — um `submit` acidental salvaria o formulário
 * inteiro da empresa só porque alguém renomeou uma marca.
 */
type PropsPainelMarcasPeca = {
  marcas: MarcaPecaListada[];
};

export function PainelMarcasPeca({ marcas }: PropsPainelMarcasPeca) {
  const router = useRouter();
  const [nomeNovo, setNomeNovo] = useState("");
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState("");
  const [processando, iniciarProcessamento] = useTransition();

  const aoCriar = () => {
    if (!nomeNovo.trim()) return;

    iniciarProcessamento(async () => {
      const resultado = await criarMarcaPeca(nomeNovo);

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      toast.success(resultado.mensagem);
      setNomeNovo("");
      router.refresh();
    });
  };

  const aoRenomear = (id: string) => {
    iniciarProcessamento(async () => {
      const resultado = await renomearMarcaPeca(id, nomeEmEdicao);

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      toast.success(resultado.mensagem);
      setIdEmEdicao(null);
      setNomeEmEdicao("");
      router.refresh();
    });
  };

  const aoAlternarSituacao = (id: string, ativa: boolean) => {
    iniciarProcessamento(async () => {
      const resultado = await definirSituacaoMarcaPeca(id, ativa);

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      toast.success(resultado.mensagem);
      router.refresh();
    });
  };

  return (
    <SecaoConfiguracoes
      titulo="Marcas de peça"
      descricao="A marca escolhida na OS vem desta lista. É ela que permite o relatório de custo e margem por peça."
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Input
            value={nomeNovo}
            onChange={(evento) => setNomeNovo(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                aoCriar();
              }
            }}
            maxLength={TAMANHO_MAXIMO_NOME_MARCA}
            placeholder="Nome da marca (ex.: Original, Incell, GX)"
            aria-label="Nome da nova marca de peça"
            disabled={processando}
          />
          <Button
            type="button"
            onClick={aoCriar}
            disabled={processando || nomeNovo.trim().length === 0}
            className="shrink-0 rounded-kx-botao"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-kx-legenda">
          Maiúsculas e acentos não criam marcas diferentes: &quot;Original&quot; e &quot;original&quot; são a
          mesma marca.
        </p>
      </div>

      {marcas.length === 0 ? (
        <p className="py-4 text-sm text-kx-legenda">
          Nenhuma marca cadastrada ainda. A primeira pode ser criada aqui ou direto no momento de lançar a
          peça na OS.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-kx-painel-borda rounded-kx-botao border border-kx-painel-borda">
          {marcas.map((marca) => {
            const editando = idEmEdicao === marca.id;

            return (
              <li key={marca.id} className="flex items-center gap-3 px-3 py-2.5">
                {editando ? (
                  <>
                    <Input
                      value={nomeEmEdicao}
                      onChange={(evento) => setNomeEmEdicao(evento.target.value)}
                      onKeyDown={(evento) => {
                        if (evento.key === "Enter") {
                          evento.preventDefault();
                          aoRenomear(marca.id);
                        }
                        if (evento.key === "Escape") {
                          evento.preventDefault();
                          setIdEmEdicao(null);
                        }
                      }}
                      maxLength={TAMANHO_MAXIMO_NOME_MARCA}
                      aria-label={`Novo nome para a marca ${marca.nome}`}
                      disabled={processando}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => aoRenomear(marca.id)}
                      disabled={processando}
                      className="shrink-0 rounded-kx-botao"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setIdEmEdicao(null)}
                      disabled={processando}
                      className="shrink-0 rounded-kx-botao"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Cancelar edição</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className={`truncate text-sm ${marca.ativa ? "text-kx-texto" : "text-kx-legenda"}`}>
                        {marca.nome}
                      </span>
                      <span className="text-xs text-kx-legenda">
                        {marca.totalItens === 0
                          ? "Ainda não usada"
                          : marca.totalItens === 1
                            ? "Usada em 1 peça"
                            : `Usada em ${marca.totalItens} peças`}
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIdEmEdicao(marca.id);
                        setNomeEmEdicao(marca.nome);
                      }}
                      disabled={processando}
                      className="shrink-0 rounded-kx-botao"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Renomear {marca.nome}</span>
                    </Button>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-kx-legenda">{marca.ativa ? "Ativa" : "Inativa"}</span>
                      <Switch
                        checked={marca.ativa}
                        onCheckedChange={(valor) => aoAlternarSituacao(marca.id, valor)}
                        disabled={processando}
                        aria-label={`${marca.ativa ? "Desativar" : "Reativar"} a marca ${marca.nome}`}
                      />
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-kx-legenda">
        Marca não se apaga: desativar tira do seletor da OS e mantém o histórico intacto. Apagar uma marca
        usada faria o relatório das OS antigas perder a referência.
      </p>
    </SecaoConfiguracoes>
  );
}
