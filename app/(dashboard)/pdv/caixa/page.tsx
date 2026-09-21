"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AbasCaixa, type AbaCaixa } from "@/components/pdv/caixa/abas-caixa";
import { PainelCaixaAberto } from "@/components/pdv/caixa/painel-caixa-aberto";
import { PainelFecharCaixa } from "@/components/pdv/caixa/painel-fechar-caixa";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { calcularPresetEsteMes, validarIntervalo, type IntervaloPeriodo } from "@/lib/filtro-periodo";
import { dataDeCalendario } from "@/lib/datas";
import {
  fecharCaixaSessionAtual,
  obterResumoSessaoAbertaDetalhado,
  verificarStatusCaixa,
  type ResumoSessaoAbertaDetalhado,
} from "@/app/actions/caixa-pdv";
import { obterResumoCaixaDiario, obterHistoricoFechamentos, type ResumoCaixaDiario, type ItemHistoricoFechamento } from "@/app/actions/caixa";
import { obterConfiguracoes } from "@/app/actions/configuracoes";

/**
 * Tela dedicada de Caixa (Fase 3-2C, Parte 3) — referência:
 * docs/design/referencia-pdv-caixa.html. Substitui o antigo modal de
 * "Fechamento de Caixa" do balcão (ver comentário em app/(dashboard)/pdv/page.tsx
 * junto ao link "Caixa e fechamento").
 *
 * Fase 2A-1 (`FiltroPeriodo`): "Últimos fechamentos" (dentro da aba
 * "fechamento") não tinha filtro de período — sempre os 5 mais recentes,
 * de qualquer data. Ganha o `FiltroPeriodo`, lido/escrito na URL como as
 * outras adoções (esta página já é Client Component, então lê via
 * `useSearchParams` em vez de receber `searchParams` como prop). Esta
 * página não busca `Configuracao.fusoHorario` do tenant hoje (é 100%
 * client-side) — o filtro usa o fuso padrão da loja (`FUSO_HORARIO_PADRAO`)
 * em vez do fuso configurado; documentado como limitação conhecida no
 * relatório da Fase 2A-1.
 */
export default function PDVCaixaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<AbaCaixa>("aberto");

  const intervaloPadraoFechamentos = useMemo(() => calcularPresetEsteMes(), []);
  const periodoFechamentos = useMemo<IntervaloPeriodo>(() => {
    const inicioTexto = searchParams.get("inicio");
    const fimTexto = searchParams.get("fim");
    const inicio = inicioTexto ? dataDeCalendario(inicioTexto) : null;
    const fim = fimTexto ? dataDeCalendario(fimTexto) : null;
    if (inicio && fim && validarIntervalo(inicio, fim).valido) {
      return { inicio, fim };
    }
    return intervaloPadraoFechamentos;
  }, [searchParams, intervaloPadraoFechamentos]);

  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [caixaAberto, setCaixaAberto] = useState(false);

  const [resumoSessao, setResumoSessao] = useState<ResumoSessaoAbertaDetalhado | null>(null);
  const [carregandoResumoSessao, setCarregandoResumoSessao] = useState(false);
  // Investigação (Fase 2A-1 follow-up): o que parecia "trava pra sempre em
  // 'Verificando o caixa...'" era, na verdade, `obterResumoSessaoAbertaDetalhado()`
  // demorando ~26-30s pra resolver em modo dev (Turbopack compilando cada
  // rota de server action pela primeira vez, mais várias outras actions do
  // chrome do app — cabeçalho, notificações, perfil — competindo na mesma
  // janela) — reproduzido IDÊNTICO em `main` (sem nenhum código da Fase
  // 2A-1) e nesta branch, com o MESMO banco de teste já migrado pra
  // timestamptz: não é regressão desta fase. Ainda assim, se a chamada
  // REALMENTE falhar (rejeitar de verdade — rede caiu, banco fora do ar),
  // o comportamento antigo prendia a tela pra sempre: `carregandoResumoSessao`
  // virava `false` no `finally`, mas como `resumoSessao` continuava `null`,
  // NENHUMA das 3 condições de render (carregando / painel aberto / painel
  // fechamento) batia — a tela ficava em branco, sem toast visível o
  // bastante e sem qualquer forma de tentar de novo sem recarregar a
  // página inteira. `erroResumoSessao` + `carregarResumoSessao` (abaixo)
  // corrigem isso: um estado de erro de verdade, com botão "Tentar
  // novamente" que só refaz ESSA chamada, sem recarregar a página nem
  // reverificar o status do caixa.
  const [erroResumoSessao, setErroResumoSessao] = useState<string | null>(null);

  const [fechamentoAutomaticoAtivo, setFechamentoAutomaticoAtivo] = useState(false);
  const [fechamentoAutomaticoHorario, setFechamentoAutomaticoHorario] = useState("23:59");

  const [resumoDiario, setResumoDiario] = useState<ResumoCaixaDiario | null>(null);
  const [fechamentos, setFechamentos] = useState<ItemHistoricoFechamento[]>([]);
  const [carregandoFechamento, setCarregandoFechamento] = useState(false);

  const [valorContadoTexto, setValorContadoTexto] = useState("");
  const [observacaoTexto, setObservacaoTexto] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  // Ref (não state) porque só serve pra decidir se ainda é seguro chamar
  // `setState` — tanto o efeito de montagem quanto o retry manual (botão
  // "Tentar novamente") escrevem nela, e nenhum dos dois deve fazer a
  // página re-renderizar só por causa desse controle.
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  // Extraído do efeito de montagem pra ser reutilizável pelo botão "Tentar
  // novamente" (ver o comentário grande em `erroResumoSessao`) — chamar de
  // novo só ISSO, nunca `verificarStatusCaixa()` de novo (o caixa já sabe
  // que está aberto; reconfirmar isso a cada retry seria refazer trabalho
  // que já deu certo).
  const carregarResumoSessao = useCallback(async () => {
    try {
      setCarregandoResumoSessao(true);
      setErroResumoSessao(null);
      const resumo = await obterResumoSessaoAbertaDetalhado();
      if (montadoRef.current) setResumoSessao(resumo);
    } catch (erro) {
      if (!montadoRef.current) return;
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível carregar o resumo do caixa.";
      setErroResumoSessao(mensagem);
      toast.error(mensagem);
    } finally {
      if (montadoRef.current) setCarregandoResumoSessao(false);
    }
  }, []);

  useEffect(() => {
    const iniciar = async () => {
      try {
        setCarregandoStatus(true);
        const status = await verificarStatusCaixa();
        if (!montadoRef.current) return;
        setCaixaAberto(status);

        if (status) {
          await carregarResumoSessao();
        }
      } catch (erro) {
        if (!montadoRef.current) return;
        const mensagem = erro instanceof Error ? erro.message : "Não foi possível verificar o status do caixa.";
        toast.error(mensagem);
      } finally {
        if (montadoRef.current) setCarregandoStatus(false);
      }
    };

    iniciar();

    obterConfiguracoes()
      .then((config) => {
        if (!montadoRef.current) return;
        setFechamentoAutomaticoAtivo(Boolean(config.fechamentoAutomaticoCaixaAtivo));
        setFechamentoAutomaticoHorario(config.fechamentoAutomaticoCaixaHorario || "23:59");
      })
      .catch(() => {
        // Sem a config, o aviso de fechamento automático so fica oculto — nao impede o uso da tela.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda só na montagem, de propósito (mesmo comportamento de antes desta correção); `carregarResumoSessao` é estável (useCallback com deps vazias).
  }, []);

  useEffect(() => {
    if (aba !== "fechamento" || !caixaAberto) return;

    let ativo = true;

    const carregar = async () => {
      try {
        setCarregandoFechamento(true);
        const [diario, historico] = await Promise.all([
          obterResumoCaixaDiario(),
          obterHistoricoFechamentos(1, 5, periodoFechamentos),
        ]);
        if (!ativo) return;
        setResumoDiario(diario);
        setFechamentos(historico.data);
      } catch {
        if (!ativo) return;
        toast.error("Não foi possível carregar o resumo do dia e o histórico de fechamentos.");
      } finally {
        if (ativo) setCarregandoFechamento(false);
      }
    };

    carregar();

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- periodoFechamentos e um objeto novo a cada render (useMemo com deps proprias); as datas em si (getTime()) sao o que realmente precisa disparar o efeito.
  }, [aba, caixaAberto, periodoFechamentos.inicio.getTime(), periodoFechamentos.fim.getTime()]);

  const confirmarFechamento = async () => {
    const valor = Number(valorContadoTexto);
    if (!Number.isFinite(valor)) return;

    try {
      setConfirmando(true);
      await fecharCaixaSessionAtual(valor, observacaoTexto.trim() || null);
      toast.success("Caixa fechado com sucesso.");
      router.push("/pdv");
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível fechar o caixa.";
      toast.error(mensagem);
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div
      // Mesmo ajuste de altura por viewport da pagina do balcao (ver
      // comentario identico em app/(dashboard)/pdv/page.tsx): o wrapper do
      // <main> no shell nao tem altura propria, entao h-full aqui vira
      // auto. 72px = barra superior; 0/16px/24px = margens do cartao
      // flutuante nos mesmos breakpoints do shell.
      className="flex h-[calc(100vh-72px)] w-full flex-col gap-4 overflow-hidden bg-kx-fundo p-5 lg:h-[calc(100vh-104px)] lg:p-6 xl:h-[calc(100vh-120px)]"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">PDV · sessão de hoje</span>
        <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">Caixa</span>
      </div>

      <AbasCaixa abaAtiva={aba} onEscolher={setAba} />

      {carregandoStatus && <p className="text-sm text-kx-legenda">Verificando o caixa...</p>}

      {!carregandoStatus && !caixaAberto && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-8 text-center">
          <p className="text-sm font-semibold text-kx-texto">Nenhum caixa aberto no momento.</p>
          <p className="text-xs text-kx-legenda">Abra o caixa no balcão para acompanhar a sessão aqui.</p>
          <Button asChild className="mt-2 h-10 rounded-kx-botao px-4 text-sm font-bold">
            <Link href="/pdv">Ir para o balcão</Link>
          </Button>
        </div>
      )}

      {!carregandoStatus && caixaAberto && carregandoResumoSessao && !resumoSessao && (
        <p className="text-sm text-kx-legenda">Carregando resumo do caixa...</p>
      )}

      {/* Antes desta correção, uma falha real aqui (rede caiu, banco fora
          do ar) deixava a tela em branco pra sempre — nenhuma das outras
          condições batia (não carregando, sem resumo). Agora aparece um
          estado de erro de verdade, com "Tentar novamente" chamando só
          `carregarResumoSessao` de novo (não a página inteira). */}
      {!carregandoStatus && caixaAberto && !carregandoResumoSessao && !resumoSessao && erroResumoSessao && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-kx-painel border border-kx-erro-borda bg-kx-erro-fundo p-8 text-center">
          <p className="text-sm font-semibold text-kx-erro-texto">Não foi possível carregar o resumo do caixa.</p>
          <p className="text-xs text-kx-erro-texto">{erroResumoSessao}</p>
          <Button type="button" className="mt-2 h-10 rounded-kx-botao px-4 text-sm font-bold" onClick={() => carregarResumoSessao()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!carregandoStatus && caixaAberto && resumoSessao && aba === "aberto" && (
        <PainelCaixaAberto
          resumo={resumoSessao}
          fechamentoAutomaticoAtivo={fechamentoAutomaticoAtivo}
          fechamentoAutomaticoHorario={fechamentoAutomaticoHorario}
          onIrParaFechamento={() => setAba("fechamento")}
        />
      )}

      {!carregandoStatus && caixaAberto && resumoSessao && aba === "fechamento" && (
        <PainelFecharCaixa
          resumoSessao={resumoSessao}
          resumoDiario={resumoDiario}
          fechamentos={fechamentos}
          carregandoFechamentos={carregandoFechamento}
          valorContadoTexto={valorContadoTexto}
          onValorContadoChange={setValorContadoTexto}
          observacaoTexto={observacaoTexto}
          onObservacaoChange={setObservacaoTexto}
          confirmando={confirmando}
          onConfirmar={confirmarFechamento}
          filtroPeriodo={<FiltroPeriodoPagina campos={[{ valor: "fechamento", rotulo: "Período" }]} />}
        />
      )}
    </div>
  );
}
