"use client";

import { useState } from "react";
import { AlertTriangle, Cable, CheckCircle2, ClipboardCopy, Copy, ExternalLink, Info, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { consultarRomSamsung, type ResultadoConsultaRom } from "@/app/actions/rom-samsung";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  compararComAparelho,
  decodificarBuild,
  normalizarModelo,
  REGIOES_DO_BRASIL,
  resumoParaOS,
  rotuloDaData,
} from "@/lib/dominio/ferramentas/rom-samsung";
import type { InfoSamsung } from "@/lib/ferramentas/adb-no-navegador";
import { cn } from "@/lib/utils";

const CAMPO = "h-11 border-kx-campo-borda bg-kx-superficie text-kx-texto placeholder:text-kx-placeholder";
const SELECT =
  "h-11 w-full rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 text-sm text-kx-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco";

const carregarAdb = () => import("@/lib/ferramentas/adb-no-navegador");
const OUTRA = "OUTRA";

async function copiar(texto: string, aviso = "Copiado.") {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

export function RomSamsung() {
  const [modelo, setModelo] = useState("");
  const [regiaoEscolhida, setRegiaoEscolhida] = useState<string>("ZTO");
  const [regiaoOutra, setRegiaoOutra] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsultaRom | null>(null);
  const [lendo, setLendo] = useState(false);
  const [aparelho, setAparelho] = useState<InfoSamsung | null>(null);
  const [erroCabo, setErroCabo] = useState<string | null>(null);

  const regiao = regiaoEscolhida === OUTRA ? regiaoOutra.trim().toUpperCase() : regiaoEscolhida;

  const consultar = async (m = modelo, r = regiao) => {
    setConsultando(true);
    setResultado(null);
    try {
      setResultado(await consultarRomSamsung(m, r));
    } catch {
      setResultado({ ok: false, erro: "Não foi possível consultar agora. Tente de novo." });
    } finally {
      setConsultando(false);
    }
  };

  const lerDoCelular = async () => {
    setErroCabo(null);
    setLendo(true);
    const m = await carregarAdb();
    let celular = null;
    try {
      if (!m.webUsbDisponivel()) {
        setErroCabo("Este navegador não acessa USB. Use o Chrome ou o Edge do computador.");
        return;
      }
      celular = await m.conectarCelular();
      if (!celular) return;
      const info = await m.lerInfoSamsung(celular);
      if (!info.samsung) {
        setErroCabo(`Este celular é ${celular.fabricante}, não Samsung.`);
        return;
      }
      setAparelho(info);
      setModelo(info.modelo);
      if (info.regiao) {
        if (REGIOES_DO_BRASIL.some((r) => r.codigo === info.regiao)) setRegiaoEscolhida(info.regiao);
        else {
          setRegiaoEscolhida(OUTRA);
          setRegiaoOutra(info.regiao);
        }
      }
      void consultar(info.modelo, info.regiao ?? regiao);
    } catch (falha) {
      setErroCabo(
        falha instanceof m.ErroDeConexao
          ? falha.message
          : falha instanceof DOMException && falha.name === "NotFoundError"
            ? null
            : "Não foi possível ler o celular. Desbloqueie, aceite o \"Permitir depuração USB\" e tente de novo."
      );
    } finally {
      await m.desconectar(celular);
      setLendo(false);
    }
  };

  const ok = resultado?.ok ? resultado : null;
  const decodificado = ok ? decodificarBuild(ok.firmware.pda) : null;
  const comparacao =
    ok && aparelho?.pda ? compararComAparelho({ modelo: aparelho.modelo, regiao: aparelho.regiao, pda: aparelho.pda }, ok) : null;
  const binarioDoAparelho = aparelho?.pda ? decodificarBuild(aparelho.pda).binario : null;

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Ferramentas</span>
        <h1 className="text-[22px] font-extrabold tracking-tight text-kx-texto">Rom Samsung</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-start">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold text-kx-texto">Qual aparelho?</h2>
              <Button type="button" variant="outline" size="sm" disabled={lendo} onClick={() => void lerDoCelular()}>
                {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Cable className="h-3.5 w-3.5" />}
                {lendo ? "Lendo… toque em Permitir" : "Ler do celular no cabo"}
              </Button>
            </div>
            {erroCabo ? (
              <p role="alert" className="rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
                {erroCabo}
              </p>
            ) : null}
            {aparelho ? (
              <p className="rounded-kx-botao bg-kx-info-fundo px-3 py-2 text-sm text-kx-info-texto">
                No celular: <strong>{aparelho.modelo}</strong>
                {aparelho.regiao ? ` · região ${aparelho.regiao}` : ""} · Android {aparelho.android}
                {aparelho.pda ? (
                  <>
                    {" "}
                    · versão <span className="font-mono font-bold">{aparelho.pda}</span>
                    {binarioDoAparelho !== null ? ` (binário ${binarioDoAparelho})` : ""}
                  </>
                ) : null}
              </p>
            ) : null}

            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void consultar();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rom-modelo" className="text-xs font-bold text-kx-texto">
                  Modelo
                </Label>
                <Input
                  id="rom-modelo"
                  className={cn(CAMPO, "font-mono uppercase")}
                  placeholder="SM-A155M"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  onBlur={() => setModelo((m) => normalizarModelo(m) ?? m)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rom-regiao" className="text-xs font-bold text-kx-texto">
                  Região (CSC)
                </Label>
                <select id="rom-regiao" className={SELECT} value={regiaoEscolhida} onChange={(e) => setRegiaoEscolhida(e.target.value)}>
                  {REGIOES_DO_BRASIL.map((r) => (
                    <option key={r.codigo} value={r.codigo}>
                      {r.codigo} — {r.nome}
                    </option>
                  ))}
                  <option value={OUTRA}>Outra…</option>
                </select>
              </div>
              <Button type="submit" className="h-11" disabled={consultando || !modelo.trim() || regiao.length !== 3}>
                {consultando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" />}
                Consultar
              </Button>
              {regiaoEscolhida === OUTRA ? (
                <div className="flex flex-col gap-1.5 sm:col-start-2">
                  <Label htmlFor="rom-regiao-outra" className="text-xs font-bold text-kx-texto">
                    Código da região
                  </Label>
                  <Input
                    id="rom-regiao-outra"
                    maxLength={3}
                    className={cn(CAMPO, "font-mono uppercase")}
                    placeholder="ex.: ZTO"
                    value={regiaoOutra}
                    onChange={(e) => setRegiaoOutra(e.target.value)}
                  />
                </div>
              ) : null}
            </form>
            <p className="text-xs text-kx-legenda">
              O modelo fica em Configurações → Sobre o telefone (ou na etiqueta da caixa). A maioria dos aparelhos vendidos no Brasil
              sem operadora é ZTO.
            </p>
          </section>

          {resultado && !resultado.ok ? (
            <p role="alert" className="rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo px-4 py-3 text-sm text-kx-alerta-texto">
              {resultado.erro}
            </p>
          ) : null}

          {ok && decodificado ? (
            <section className="flex flex-col gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs text-kx-legenda">
                    ROM mais recente da Samsung · {ok.modelo} · {ok.regiao}
                  </span>
                  <span className="font-mono text-2xl font-extrabold tracking-tight text-kx-texto">{ok.firmware.pda}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void copiar(resumoParaOS(ok.modelo, ok.regiao, ok.firmware, aparelho?.pda ?? null), "Resumo copiado. Cole nas observações da OS.")}>
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copiar para a OS
                </Button>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Dado rotulo="Android" valor={ok.firmware.android ?? "—"} />
                <Dado rotulo="Lançada em" valor={rotuloDaData(decodificado) ?? "—"} />
                <Dado rotulo="Binário" valor={decodificado.binario?.toString() ?? "—"} destaque />
                <Dado rotulo="Tipo" valor={decodificado.tipo === "SEGURANCA" ? "Segurança" : decodificado.tipo === "NOVIDADES" ? "Com novidades" : "—"} />
              </dl>
              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <Dado rotulo="AP / PDA" valor={ok.firmware.pda} mono />
                <Dado rotulo="CSC" valor={ok.firmware.csc} mono />
                <Dado rotulo="Modem (CP)" valor={ok.firmware.modem || "sem modem (Wi-Fi)"} mono />
              </dl>

              {comparacao ? <AvisoComparacao comparacao={comparacao} /> : null}

              <p className="flex items-start gap-2 text-xs text-kx-legenda">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Binário: não dá para gravar uma ROM com binário menor que o do celular — o aparelho recusa no Odin.
              </p>
            </section>
          ) : null}
        </div>

        <section className="flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5 text-sm text-kx-texto-2">
          <h2 className="text-[17px] font-bold text-kx-texto">Baixar a ROM pelo Bifrost</h2>
          <p>
            A ROM tem de 3 a 8 GB e vem direto dos servidores da Samsung. Quem baixa é o <strong className="text-kx-texto">Bifrost</strong>,
            programa gratuito e de código aberto, instalado uma vez no computador da bancada.
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>
              Instale o Bifrost:{" "}
              <a href="https://bifrost.zwander.dev" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-kx-link hover:underline">
                bifrost.zwander.dev <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </li>
            <li>
              Na tela de download do Bifrost, preencha:
              <div className="mt-2 flex flex-wrap gap-2">
                <BotaoCopiar rotulo="Modelo" valor={ok?.modelo ?? normalizarModelo(modelo) ?? ""} />
                <BotaoCopiar rotulo="Região" valor={ok?.regiao ?? regiao} />
              </div>
              <span className="mt-1 block text-xs text-kx-legenda">
                Se pedir IMEI ou número de série, use o do aparelho do cliente (disque *#06# no celular).
              </span>
            </li>
            <li>
              Mande verificar a versão (deve aparecer a mesma daqui) e baixe com a opção de descriptografar o arquivo marcada — sai um
              .zip pronto para o Odin.
            </li>
            <li>
              Grave com o <strong className="text-kx-texto">Odin</strong>: celular desligado, segure <em>volume para cima + volume para
              baixo</em> e ligue o cabo (modo Download). Coloque BL, AP, CP e CSC nos campos do Odin — use o <em>HOME_CSC</em> para não
              apagar os dados do cliente.
            </li>
          </ol>
          <p className="text-xs text-kx-legenda">
            O TechOS só consulta a versão: o arquivo não passa pelo nosso servidor.
          </p>
        </section>
      </div>
    </>
  );
}

function Dado({ rotulo, valor, destaque, mono }: { rotulo: string; valor: string; destaque?: boolean; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-kx-botao bg-kx-superficie px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">{rotulo}</dt>
      <dd className={cn("break-all font-bold text-kx-texto", destaque && "text-lg", mono && "font-mono")}>{valor}</dd>
    </div>
  );
}

function BotaoCopiar({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={!valor} onClick={() => void copiar(valor, `${rotulo} copiado.`)}>
      <Copy className="h-3.5 w-3.5" />
      {rotulo}: <span className="font-mono">{valor || "—"}</span>
    </Button>
  );
}

function AvisoComparacao({ comparacao }: { comparacao: ReturnType<typeof compararComAparelho> }) {
  switch (comparacao.situacao) {
    case "EM_DIA":
      return (
        <p className="flex items-center gap-2 rounded-kx-botao bg-kx-sucesso-fundo px-3 py-2 text-sm text-kx-sucesso-texto">
          <CheckCircle2 className="h-4 w-4" /> O celular já está na versão mais recente.
        </p>
      );
    case "DESATUALIZADO":
      return (
        <p className="flex items-center gap-2 rounded-kx-botao bg-kx-alerta-fundo px-3 py-2 text-sm text-kx-alerta-texto">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          O celular está desatualizado.{comparacao.binarioOk ? " Pode gravar esta ROM (binário compatível)." : ""}
        </p>
      );
    case "MAIS_NOVO_QUE_O_SERVIDOR":
      return (
        <p className="flex items-center gap-2 rounded-kx-botao bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          O celular está numa versão mais nova (ou com binário maior) que esta: não grave esta ROM, o aparelho vai recusar.
        </p>
      );
    case "OUTRO_MODELO_OU_REGIAO":
      return (
        <p className="flex items-center gap-2 rounded-kx-botao bg-kx-info-fundo px-3 py-2 text-sm text-kx-info-texto">
          <Info className="h-4 w-4 shrink-0" />A consulta é de outro modelo ou região do que o celular no cabo.
        </p>
      );
  }
}
