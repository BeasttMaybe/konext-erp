"use client";

import { useActionState } from "react";

import { criarPrimeiroAcesso, entrar, type EstadoDoFormulario } from "./acoes";

const CAMPO =
  "h-11 w-full rounded-lg border border-borda bg-fundo px-3 text-sm text-texto outline-none placeholder:text-legenda focus:border-destaque";

function Campo(props: { rotulo: string; nome: string; tipo?: string; autoComplete?: string; dica?: string; valor?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-texto-2">{props.rotulo}</span>
      <input
        name={props.nome}
        type={props.tipo ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.valor}
        required
        className={CAMPO}
      />
      {props.dica ? <span className="text-xs text-legenda">{props.dica}</span> : null}
    </label>
  );
}

function Erro({ estado }: { estado: EstadoDoFormulario }) {
  return estado.erro ? (
    <p role="alert" className="rounded-lg border border-erro/40 bg-erro/10 px-3 py-2 text-sm text-erro">
      {estado.erro}
    </p>
  ) : null;
}

function Botao({ pendente, texto }: { pendente: boolean; texto: string }) {
  return (
    <button
      type="submit"
      disabled={pendente}
      className="h-11 rounded-lg bg-destaque text-sm font-bold text-fundo transition-opacity disabled:opacity-60"
    >
      {pendente ? "Aguarde…" : texto}
    </button>
  );
}

export function FormularioEntrar() {
  const [estado, acao, pendente] = useActionState(entrar, { erro: null });
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Erro estado={estado} />
      <Campo rotulo="E-mail" nome="email" tipo="email" autoComplete="username" valor={estado.valores?.email} />
      <Campo rotulo="Senha" nome="senha" tipo="password" autoComplete="current-password" />
      <Botao pendente={pendente} texto="Entrar" />
    </form>
  );
}

export function FormularioPrimeiroAcesso() {
  const [estado, acao, pendente] = useActionState(criarPrimeiroAcesso, { erro: null });
  return (
    <form action={acao} className="flex flex-col gap-4">
      <p className="text-sm text-texto-2">
        Ainda não há administrador. Crie o seu usando o <strong>código de criação</strong> que você definiu na Vercel
        (variável <code className="text-destaque">MASTER_CODIGO_DE_CRIACAO</code>). Depois disso, esta tela some.
      </p>
      <Erro estado={estado} />
      <Campo rotulo="Código de criação" nome="codigo" tipo="password" autoComplete="off" />
      <Campo rotulo="Seu nome" nome="nome" autoComplete="name" valor={estado.valores?.nome} />
      <Campo rotulo="E-mail" nome="email" tipo="email" autoComplete="username" valor={estado.valores?.email} />
      <Campo rotulo="Senha" nome="senha" tipo="password" autoComplete="new-password" dica="Mínimo de 12 caracteres, com letras e números." />
      <Campo rotulo="Repita a senha" nome="confirmacao" tipo="password" autoComplete="new-password" />
      <Botao pendente={pendente} texto="Criar meu acesso" />
    </form>
  );
}
