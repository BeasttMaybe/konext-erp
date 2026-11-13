"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleSlash, Loader2 } from "lucide-react";

import { ResultadoDaCriacao } from "~/components/resultado-da-criacao";

import { continuarCriacao } from "../nova/acoes";
import { definirModulo, definirSituacaoDaLoja } from "./acoes";

type Modulo = { id: string; nome: string; ativo: boolean; motivo: "padrao" | "gravado" | "dependencia"; desligadoPeloMaster: boolean };

const ROTULO_MOTIVO = {
  padrao: "Ligado (padrão)",
  gravado: "Desligado pelo master",
  dependencia: "Desligado porque depende de outro módulo",
} as const;

export function ModulosDaLoja({ empresaId, modulos }: { empresaId: string; modulos: Modulo[] }) {
  const [pendente, iniciar] = useTransition();
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (modulo: Modulo) => {
    // O interruptor mostra o que o master gravou: um modulo desligado so por
    // dependencia continua "ligado" aqui e volta sozinho quando o requisito voltar.
    const ligar = modulo.desligadoPeloMaster;
    setErro(null);
    setMexendo(modulo.id);
    iniciar(async () => {
      const r = await definirModulo(empresaId, modulo.id, ligar);
      if (!r.ok) setErro(r.erro);
      setMexendo(null);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {erro ? <p role="alert" className="rounded-lg border border-erro/40 bg-erro/10 px-3 py-2 text-sm text-erro">{erro}</p> : null}
      <ul className="flex flex-col gap-2">
        {modulos.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            {m.ativo ? (
              <CircleCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden />
            ) : (
              <CircleSlash className="h-4 w-4 shrink-0 text-legenda" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold ${m.ativo ? "" : "text-legenda"}`}>{m.nome}</span>
              <span className="block text-xs text-legenda">{m.ativo ? (m.motivo === "padrao" ? ROTULO_MOTIVO.padrao : "Ligado") : ROTULO_MOTIVO[m.motivo]}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!m.desligadoPeloMaster}
              aria-label={`${m.nome}: ${m.desligadoPeloMaster ? "ligar" : "desligar"}`}
              disabled={pendente}
              onClick={() => alternar(m)}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
                m.desligadoPeloMaster ? "border-borda bg-fundo" : "border-ok/50 bg-ok/30"
              }`}
            >
              <span
                className={`absolute top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-texto transition-all ${
                  m.desligadoPeloMaster ? "left-0.5" : "left-[22px]"
                }`}
              >
                {mexendo === m.id ? <Loader2 className="h-3 w-3 animate-spin text-fundo" aria-hidden /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-legenda">Vale na próxima tela que alguém da loja abrir. Nenhum dado é apagado ao desligar.</p>
    </div>
  );
}

export function SituacaoDaLoja({ empresaId, slug, status }: { empresaId: string; slug: string; status: string }) {
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const suspensa = status === "SUSPENSA";

  const enviar = (situacao: "ATIVA" | "SUSPENSA") => {
    setErro(null);
    iniciar(async () => {
      const r = await definirSituacaoDaLoja(empresaId, situacao, digitado);
      if (!r.ok) setErro(r.erro);
      else {
        setConfirmando(false);
        setDigitado("");
      }
    });
  };

  if (suspensa) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-alerta">Loja suspensa: ninguém da loja consegue entrar, e os links públicos estão parados.</p>
        {erro ? <p role="alert" className="text-sm text-erro">{erro}</p> : null}
        <button type="button" disabled={pendente} onClick={() => enviar("ATIVA")} className="h-10 w-fit rounded-lg bg-ok px-4 text-sm font-bold text-fundo disabled:opacity-60">
          {pendente ? "Reativando…" : "Reativar loja"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-texto-2">Loja ativa. Suspender corta o acesso de todos da loja na próxima tela; nada é apagado.</p>
      {erro ? <p role="alert" className="text-sm text-erro">{erro}</p> : null}
      {confirmando ? (
        <div className="flex flex-col gap-2 rounded-lg border border-erro/40 bg-erro/5 p-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-texto-2">
              Para confirmar, digite <strong className="font-mono text-texto">{slug}</strong>
            </span>
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              autoComplete="off"
              className="h-10 rounded-lg border border-borda bg-fundo px-3 font-mono text-sm outline-none focus:border-erro"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={pendente || digitado.trim() !== slug} onClick={() => enviar("SUSPENSA")} className="h-10 rounded-lg bg-erro px-4 text-sm font-bold text-fundo disabled:opacity-50">
              {pendente ? "Suspendendo…" : "Suspender agora"}
            </button>
            <button type="button" onClick={() => { setConfirmando(false); setDigitado(""); }} className="h-10 rounded-lg border border-borda px-4 text-sm text-texto-2">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className="h-10 w-fit rounded-lg border border-erro/50 px-4 text-sm font-semibold text-erro hover:bg-erro/10">
          Suspender loja…
        </button>
      )}
    </div>
  );
}

export function ContinuarCriacao({ empresaId, enderecoDoErp }: { empresaId: string; enderecoDoErp: string | null }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ email: string; senha: string | null } | null>(null);

  if (pronto) return <ResultadoDaCriacao empresaId={empresaId} email={pronto.email} senha={pronto.senha} enderecoDoErp={enderecoDoErp} />;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-alerta/40 bg-alerta/5 p-4">
      <p className="text-sm font-semibold text-alerta">A criação desta loja não terminou.</p>
      <p className="text-sm text-texto-2">Ninguém da loja consegue entrar ainda. Continuar refaz só o que falta — nada é duplicado.</p>
      {erro ? <p role="alert" className="text-sm text-erro">{erro}</p> : null}
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await continuarCriacao(empresaId).catch(() => ({ ok: false as const, erro: "A conexão caiu. Tente de novo." }));
            if (r.ok) setPronto({ email: r.email, senha: r.senhaTemporaria });
            else setErro(r.erro);
          })
        }
        className="flex h-10 w-fit items-center gap-2 rounded-lg bg-alerta px-4 text-sm font-bold text-fundo disabled:opacity-60"
      >
        {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pendente ? "Continuando…" : "Continuar criação"}
      </button>
    </div>
  );
}
