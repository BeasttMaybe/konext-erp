"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { criarCategoriaProduto } from "@/app/actions/categorias-produto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CategoriaOpcao = { id: string; nome: string };

/**
 * Escolhe a categoria e permite criar uma na hora.
 *
 * Criar aqui, sem sair da tela, é o que faz a categoria cadastrável valer a
 * pena: se o dono tivesse que ir a Configurações, criar "Capas" e voltar pra
 * recomeçar o cadastro do produto, ele usaria "Outros" pra sempre — que é
 * exatamente o que acontecia com as cinco categorias fixas.
 */
export function SeletorCategoria({
  categorias,
  valor,
  aoMudar,
  aoCriar,
  desabilitado,
}: {
  categorias: CategoriaOpcao[];
  valor: string;
  aoMudar: (categoriaId: string) => void;
  /** Avisa a página para recarregar a lista e já selecionar a nova. */
  aoCriar: (categoria: CategoriaOpcao) => void;
  desabilitado?: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [emAndamento, iniciarTransicao] = useTransition();

  const salvar = () => {
    iniciarTransicao(async () => {
      const resultado = await criarCategoriaProduto(nome);

      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return;
      }

      toast.success(resultado.mensagem);
      aoCriar(resultado.categoria);
      setNome("");
      setCriando(false);
    });
  };

  if (criando) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          value={nome}
          placeholder="Capas, Películas, Fones..."
          aria-label="Nome da nova categoria"
          disabled={emAndamento}
          onChange={(evento) => setNome(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              salvar();
            }
            if (evento.key === "Escape") setCriando(false);
          }}
        />
        <Button type="button" size="sm" disabled={emAndamento || nome.trim() === ""} onClick={salvar}>
          Criar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={emAndamento}
          onClick={() => setCriando(false)}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={valor} onValueChange={aoMudar} disabled={desabilitado}>
        <SelectTrigger className="flex-1" aria-label="Categoria">
          <SelectValue placeholder="Escolha a categoria" />
        </SelectTrigger>
        <SelectContent>
          {categorias.map((categoria) => (
            <SelectItem key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Criar categoria"
        title="Criar categoria"
        disabled={desabilitado}
        onClick={() => setCriando(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
