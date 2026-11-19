"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import Link from "next/link";

import { obterConversas } from "@/app/actions/marketing";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { CaixaDeEntrada } from "@/components/marketing/caixa-de-entrada";

type Conversa = {
  id: string;
  contaId: string;
  plataforma: string;
  participante: string;
  usuario: string;
  foto: string | null;
  ultimaMensagem: string;
  atualizadoEm: string;
  naoLidas: number;
};

function LogoInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WidgetMensagens() {
  const podeVer = useTemPermissao("marketing.ver");
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [dados, setDados] = useState<{ conversas: Conversa[]; proximoCursor: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!podeVer) return null;

  const abrir = async () => {
    setAberto(true);
    if (carregado) return;
    setCarregando(true);
    try {
      const r = await obterConversas();
      if (r.ok) setDados({ conversas: r.conversas, proximoCursor: r.proximoCursor });
      else setErro(r.erro);
    } catch {
      setErro("Não foi possível carregar as mensagens agora.");
    } finally {
      setCarregado(true);
      setCarregando(false);
    }
  };

  return (
    <>
      {aberto ? (
        <div className="fixed bottom-24 right-4 z-[60] flex h-[560px] max-h-[calc(100vh-7rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-kx-painel border border-kx-painel-borda bg-kx-painel shadow-kx-cartao">
          <div className="kx-gradiente-instagram flex items-center justify-between gap-2 px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <LogoInstagram className="h-4 w-4" />
              <span className="text-sm font-bold">Mensagens do Instagram</span>
            </div>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-full p-1 transition-opacity hover:opacity-80">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {carregando ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-kx-legenda" aria-hidden />
              </div>
            ) : erro ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-kx-legenda">{erro}</p>
                <Link href="/marketing/conexoes" className="rounded-kx-botao bg-kx-primaria px-3 py-1.5 text-sm font-bold text-primary-foreground hover:opacity-90">
                  Conexões
                </Link>
              </div>
            ) : dados ? (
              <CaixaDeEntrada compacto inicial={dados} />
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => (aberto ? setAberto(false) : void abrir())}
        aria-label="Mensagens do Instagram"
        className="kx-gradiente-instagram fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-kx-cartao transition-transform hover:scale-105 active:scale-95"
      >
        {aberto ? <X className="h-6 w-6" /> : <LogoInstagram className="h-7 w-7" />}
      </button>
    </>
  );
}
