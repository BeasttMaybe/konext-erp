"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  criarCategoriaProduto,
  definirSituacaoCategoriaProduto,
  renomearCategoriaProduto,
  type CategoriaProdutoListada,
} from "@/app/actions/categorias-produto";
import { TAMANHO_MAXIMO_NOME_CATEGORIA } from "@/lib/dominio/estoque/categoria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { SecaoConfiguracoes } from "./secao-configuracoes";

/**
 * Cadastro das categorias de produto.
 *
 * As ações de renomear e desativar existem desde que a categoria deixou de
 * ser um enum do código e virou cadastro do dono — com log de auditoria e
 * tudo. O que não existia era a tela: dava pra CRIAR uma categoria pelo
 * seletor do produto, e só. Quem digitasse "Capinhas" no lugar de "Capas"
 * ficava com a categoria errada para sempre, e a lista do seletor só
 * crescia, porque nada saía dela.
 *
 * Espelha `painel-marcas-peca.tsx` de propósito: são o mesmo tipo de
 * cadastro, e dois desenhos diferentes para a mesma coisa fariam a pessoa
 * reaprender a tela.
 *
 * Cuidado estrutural, igual ao painel de marcas: isto vive dentro do
 * `<form>` de Configurações, que tem o próprio botão de salvar. Todo botão
 * aqui é `type="button"` e o Enter dos campos é interceptado — um `submit`
 * acidental salvaria o cadastro inteiro da empresa só porque alguém
 * renomeou uma categoria.
 */
export function PainelCategoriasProduto({
  categorias,
}: {
  categorias: CategoriaProdutoListada[];
}) {
  const router = useRouter();
  const [nomeNovo, setNomeNovo] = useState("");
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState("");
  const [processando, iniciarProcessamento] = useTransition();

  const aoCriar = () => {
    if (!nomeNovo.trim()) return;

    iniciarProcessamento(async () => {
      const resultado = await criarCategoriaProduto(nomeNovo);

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
      const resultado = await renomearCategoriaProduto(id, nomeEmEdicao);

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
      const resultado = await definirSituacaoCategoriaProduto(id, ativa);

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
      titulo="Categorias de produto"
      descricao="A categoria escolhida no cadastro do produto vem desta lista. É ela que agrupa o estoque, filtra o PDV e dá o prefixo do SKU."
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
            maxLength={TAMANHO_MAXIMO_NOME_CATEGORIA}
            placeholder="Nome da categoria (ex.: Capas, Películas, Carregadores)"
            aria-label="Nome da nova categoria de produto"
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
          Maiúsculas e acentos não criam categorias diferentes: &quot;Capas&quot; e &quot;capas&quot; são a
          mesma categoria.
        </p>
      </div>

      {categorias.length === 0 ? (
        <p className="py-4 text-sm text-kx-legenda">
          Nenhuma categoria cadastrada ainda. A primeira pode ser criada aqui ou direto no cadastro do
          produto.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-kx-painel-borda rounded-kx-botao border border-kx-painel-borda">
          {categorias.map((categoria) => {
            const editando = idEmEdicao === categoria.id;

            return (
              <li key={categoria.id} className="flex items-center gap-3 px-3 py-2.5">
                {editando ? (
                  <>
                    <Input
                      value={nomeEmEdicao}
                      onChange={(evento) => setNomeEmEdicao(evento.target.value)}
                      onKeyDown={(evento) => {
                        if (evento.key === "Enter") {
                          evento.preventDefault();
                          aoRenomear(categoria.id);
                        }
                        if (evento.key === "Escape") {
                          evento.preventDefault();
                          setIdEmEdicao(null);
                        }
                      }}
                      maxLength={TAMANHO_MAXIMO_NOME_CATEGORIA}
                      aria-label={`Novo nome para a categoria ${categoria.nome}`}
                      disabled={processando}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => aoRenomear(categoria.id)}
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
                      <span
                        className={`truncate text-sm ${categoria.ativa ? "text-kx-texto" : "text-kx-legenda"}`}
                      >
                        {categoria.nome}
                      </span>
                      {/* Duas contagens porque elas respondem perguntas
                          diferentes: os ativos decidem se dá pra desativar a
                          categoria agora, e o total conta a história ("vazia
                          hoje, mas já teve produto"). */}
                      <span className="text-xs text-kx-legenda">
                        {categoria.produtosAtivos === 0
                          ? categoria.produtosNoTotal === 0
                            ? "Nenhum produto"
                            : `Nenhum produto ativo · ${categoria.produtosNoTotal} no histórico`
                          : categoria.produtosAtivos === 1
                            ? "1 produto ativo"
                            : `${categoria.produtosAtivos} produtos ativos`}
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIdEmEdicao(categoria.id);
                        setNomeEmEdicao(categoria.nome);
                      }}
                      disabled={processando}
                      className="shrink-0 rounded-kx-botao"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Renomear {categoria.nome}</span>
                    </Button>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-kx-legenda">
                        {categoria.ativa ? "Ativa" : "Inativa"}
                      </span>
                      <Switch
                        checked={categoria.ativa}
                        onCheckedChange={(valor) => aoAlternarSituacao(categoria.id, valor)}
                        disabled={processando}
                        aria-label={`${categoria.ativa ? "Desativar" : "Reativar"} a categoria ${categoria.nome}`}
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
        Categoria não se apaga: desativar tira do cadastro de produto novo e mantém o histórico intacto.
        Renomear muda o rótulo em todo o estoque que aponta pra ela — o SKU já impresso não muda.
      </p>
    </SecaoConfiguracoes>
  );
}
