"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { ResultadoDaCriacao } from "~/components/resultado-da-criacao";
import { sugerirSlug } from "~/lib/regras-loja-nova";

import { criarLoja } from "./acoes";

const CAMPO =
  "h-11 w-full rounded-lg border border-borda bg-fundo px-3 text-sm text-texto outline-none placeholder:text-legenda focus:border-destaque";

export function FormularioLojaNova({ enderecoDoErp }: { enderecoDoErp: string | null }) {
  const [nomeDaLoja, setNomeDaLoja] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [donoNome, setDonoNome] = useState("");
  const [donoEmail, setDonoEmail] = useState("");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ empresaId: string; email: string; senha: string | null } | null>(null);

  if (pronto) {
    return <ResultadoDaCriacao empresaId={pronto.empresaId} email={pronto.email} senha={pronto.senha} enderecoDoErp={enderecoDoErp} />;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await criarLoja({ nomeDaLoja, slug, donoNome, donoEmail }).catch(() => ({
            ok: false as const,
            erro: "A conexão caiu durante a criação. Abra a loja na lista e toque em \"Continuar criação\".",
          }));
          if (r.ok) setPronto({ empresaId: r.empresaId, email: r.email, senha: r.senhaTemporaria });
          else setErro(r.erro);
        });
      }}
    >
      <fieldset disabled={pendente} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-texto-2">Nome da loja</span>
          <input
            required
            value={nomeDaLoja}
            onChange={(e) => {
              setNomeDaLoja(e.target.value);
              if (!slugEditado) setSlug(sugerirSlug(e.target.value));
            }}
            placeholder="Assistência do João"
            className={CAMPO}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-texto-2">Identificador</span>
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugEditado(true);
              setSlug(e.target.value.toLowerCase());
            }}
            placeholder="assistencia-do-joao"
            className={`${CAMPO} font-mono`}
          />
          <span className="text-xs text-legenda">Nome curto e único, usado nos endereços e no banco. Não muda depois.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-texto-2">Nome do responsável</span>
          <input required value={donoNome} onChange={(e) => setDonoNome(e.target.value)} placeholder="João Silva" className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-texto-2">E-mail do responsável</span>
          <input required type="email" value={donoEmail} onChange={(e) => setDonoEmail(e.target.value)} placeholder="joao@email.com" className={CAMPO} />
          <span className="text-xs text-legenda">Vira o login dele, como administrador da loja.</span>
        </label>
      </fieldset>

      {erro ? <p role="alert" className="rounded-lg border border-erro/40 bg-erro/10 px-3 py-2 text-sm text-erro">{erro}</p> : null}

      <button type="submit" disabled={pendente} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-destaque text-sm font-bold text-fundo disabled:opacity-70">
        {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pendente ? "Criando o banco e preparando a loja… (até 1 minuto)" : "Criar loja"}
      </button>
    </form>
  );
}
