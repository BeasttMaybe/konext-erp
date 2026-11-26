"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Eye, EyeOff, Lock, Mail } from "lucide-react";

import { pedirLinkDeRecuperacao, redefinirSenhaPeloLink } from "@/app/actions/recuperar-senha";

const classeFoco = "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2";

const estiloCampo: React.CSSProperties = {
  height: 52,
  borderRadius: 14,
  backgroundColor: "var(--kx-painel)",
  border: "1px solid var(--kx-campo-borda)",
  color: "var(--kx-texto)",
};

export function Aviso({ tipo, children }: { tipo: "erro" | "sucesso" | "info"; children: React.ReactNode }) {
  const cores = {
    erro: { fundo: "var(--kx-erro-fundo)", texto: "var(--kx-erro-texto)", icone: "var(--kx-erro-icone)" },
    sucesso: { fundo: "var(--kx-sucesso-fundo)", texto: "var(--kx-sucesso-texto)", icone: "var(--kx-sucesso-texto)" },
    info: { fundo: "var(--kx-painel)", texto: "var(--kx-texto-2)", icone: "var(--kx-legenda)" },
  }[tipo];
  const Icone = tipo === "sucesso" ? CircleCheck : CircleAlert;
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className="flex items-start gap-3 rounded-kx-cartao px-4 py-3.5 text-sm leading-[1.45]"
      style={{ backgroundColor: cores.fundo, color: cores.texto, border: tipo === "info" ? "1px solid var(--kx-campo-borda)" : undefined }}
    >
      <Icone className="mt-0.5 h-5 w-5 shrink-0" style={{ color: cores.icone }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function BotaoPrincipal({ carregando, texto, textoCarregando }: { carregando: boolean; texto: string; textoCarregando: string }) {
  return (
    <button
      type="submit"
      disabled={carregando}
      className={`flex h-[54px] items-center justify-center gap-2.5 rounded-kx-cartao text-base font-extrabold transition-opacity ${classeFoco}`}
      style={{
        backgroundColor: "var(--kx-primaria)",
        color: "var(--primary-foreground)",
        opacity: carregando ? 0.7 : 1,
        outlineColor: "var(--kx-foco)",
      }}
    >
      {carregando ? textoCarregando : texto}
      <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}

export function VoltarAoLogin() {
  return (
    <Link
      href="/login"
      className={`inline-flex items-center gap-2 text-sm font-semibold hover:text-kx-link ${classeFoco}`}
      style={{ color: "var(--kx-link)", outlineColor: "var(--kx-foco)" }}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Voltar para o login
    </Link>
  );
}

export function FormularioPedirLink() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setCarregando(true);
    try {
      const resposta = await pedirLinkDeRecuperacao(email);
      setResultado(resposta.ok ? { tipo: "sucesso", texto: resposta.mensagem } : { tipo: "erro", texto: resposta.erro });
    } catch {
      setResultado({ tipo: "erro", texto: "Não foi possível enviar agora. Tente de novo em instantes." });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}
      <div className="flex flex-col gap-2">
        <label htmlFor="email-recuperacao" className="text-sm font-bold" style={{ color: "var(--kx-texto)" }}>
          E-mail da sua conta
        </label>
        <div className="flex items-center gap-2.5 px-4" style={estiloCampo}>
          <Mail className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--kx-legenda)" }} aria-hidden />
          <input
            id="email-recuperacao"
            type="email"
            required
            autoComplete="username"
            placeholder="voce@sualoja.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`h-full flex-grow bg-transparent text-[15px] outline-none ${classeFoco}`}
            style={{ color: "var(--kx-texto)", outlineColor: "var(--kx-foco)" }}
          />
        </div>
      </div>
      <BotaoPrincipal carregando={carregando} texto="Enviar link" textoCarregando="Enviando…" />
    </form>
  );
}

function CampoSenha({ id, rotulo, valor, onMudar, autoFocus }: { id: string; rotulo: string; valor: string; onMudar: (v: string) => void; autoFocus?: boolean }) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold" style={{ color: "var(--kx-texto)" }}>
        {rotulo}
      </label>
      <div className="flex items-center gap-2.5 py-0 pl-4 pr-1.5" style={estiloCampo}>
        <Lock className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--kx-legenda)" }} aria-hidden />
        <input
          id={id}
          type={mostrar ? "text" : "password"}
          required
          autoFocus={autoFocus}
          autoComplete="new-password"
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          className={`h-full flex-grow bg-transparent text-[15px] outline-none ${classeFoco}`}
          style={{ color: "var(--kx-texto)", outlineColor: "var(--kx-foco)" }}
        />
        <button
          type="button"
          onClick={() => setMostrar((atual) => !atual)}
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={mostrar}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-kx-cartao ${classeFoco}`}
          style={{ color: "var(--kx-texto-2)", outlineColor: "var(--kx-foco)" }}
        >
          {mostrar ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export function FormularioNovaSenha({ token }: { token: string }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await redefinirSenhaPeloLink({ token, novaSenha, confirmacao });
      if (resposta.ok) setPronto(true);
      else setErro(resposta.erro);
    } catch {
      setErro("Não foi possível trocar a senha agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  };

  if (pronto) {
    return (
      <div className="flex flex-col gap-5">
        <Aviso tipo="sucesso">Senha trocada. Entre com a senha nova — os acessos que estavam abertos foram encerrados.</Aviso>
        <Link
          href="/login"
          className={`flex h-[54px] items-center justify-center gap-2.5 rounded-kx-cartao text-base font-extrabold ${classeFoco}`}
          style={{ backgroundColor: "var(--kx-primaria)", color: "var(--primary-foreground)", outlineColor: "var(--kx-foco)" }}
        >
          Ir para o login
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <CampoSenha id="nova-senha" rotulo="Senha nova" valor={novaSenha} onMudar={setNovaSenha} autoFocus />
      <CampoSenha id="confirmar-senha" rotulo="Repita a senha nova" valor={confirmacao} onMudar={setConfirmacao} />
      <p className="m-0 text-[13px]" style={{ color: "var(--kx-legenda)" }}>
        Mínimo de 8 caracteres, com letras e números.
      </p>
      <BotaoPrincipal carregando={carregando} texto="Salvar senha nova" textoCarregando="Salvando…" />
    </form>
  );
}
