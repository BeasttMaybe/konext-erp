"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { criarCliente } from "@/app/actions/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formClienteSchema } from "@/lib/validations/crm";

const CAMPO_PADRAO =
  "h-12 rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 text-base text-kx-texto placeholder:text-kx-placeholder";

export type ClienteCadastrado = {
  id: string;
  nomeRazaoSocial: string;
  documento: string | null;
  telefone: string;
};

/**
 * Cadastro com o minimo: nome e telefone, os dois campos que a regra do
 * cliente exige. O resto (CPF, endereco) se completa depois na tela do
 * cliente — no balcao, com o aparelho na mao, ninguem para para isso.
 */
export function CadastroRapidoDoCliente({
  nomeInicial,
  onCancelar,
  onCadastrado,
  classeDoCampo = CAMPO_PADRAO,
}: {
  nomeInicial: string;
  onCancelar: () => void;
  onCadastrado: (cliente: ClienteCadastrado) => void;
  /** Classe dos campos, para combinar com a tela que usa o cadastro. */
  classeDoCampo?: string;
}) {
  // Se o que foi digitado na busca parece telefone, ele vai para o telefone.
  const pareceTelefone = /^[\d\s()+-]+$/.test(nomeInicial);
  const [nome, setNome] = useState(pareceTelefone ? "" : nomeInicial);
  const [telefone, setTelefone] = useState(pareceTelefone ? nomeInicial : "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const cadastrar = async () => {
    const validado = formClienteSchema.safeParse({ nomeRazaoSocial: nome.trim(), telefone: telefone.trim() });
    if (!validado.success) {
      setErro(validado.error.issues[0]?.message ?? "Confira nome e telefone.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await criarCliente(validado.data);
      if (!resultado.sucesso) {
        setErro(resultado.mensagem);
        return;
      }
      onCadastrado({
        id: resultado.cliente.id,
        nomeRazaoSocial: resultado.cliente.nomeRazaoSocial,
        documento: resultado.cliente.documento ?? null,
        telefone: resultado.cliente.telefone,
      });
      toast.success("Cliente cadastrado.");
    } catch {
      setErro("Não foi possível cadastrar o cliente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-kx-cartao border border-kx-painel-borda bg-kx-painel p-3.5">
      <p className="text-sm font-semibold text-kx-texto">Cliente novo</p>
      <Input
        className={classeDoCampo}
        placeholder="Nome"
        aria-label="Nome do cliente"
        autoCapitalize="words"
        autoComplete="off"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Input
        className={classeDoCampo}
        placeholder="Telefone com DDD"
        aria-label="Telefone do cliente"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
      />
      {erro ? (
        <p role="alert" className="text-sm font-medium text-kx-erro-texto">
          {erro}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancelar} disabled={salvando}>
          Voltar à busca
        </Button>
        <Button type="button" className="h-11 flex-1" onClick={() => void cadastrar()} disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Cadastrar
        </Button>
      </div>
    </div>
  );
}
