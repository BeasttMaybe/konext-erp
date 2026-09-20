"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AbasCaixa, type AbaCaixa } from "@/components/pdv/caixa/abas-caixa";
import { PainelCaixaAberto } from "@/components/pdv/caixa/painel-caixa-aberto";
import { PainelFecharCaixa } from "@/components/pdv/caixa/painel-fechar-caixa";
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
 */
export default function PDVCaixaPage() {
  const router = useRouter();
  const [aba, setAba] = useState<AbaCaixa>("aberto");

  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [caixaAberto, setCaixaAberto] = useState(false);

  const [resumoSessao, setResumoSessao] = useState<ResumoSessaoAbertaDetalhado | null>(null);
  const [carregandoResumoSessao, setCarregandoResumoSessao] = useState(false);

  const [fechamentoAutomaticoAtivo, setFechamentoAutomaticoAtivo] = useState(false);
  const [fechamentoAutomaticoHorario, setFechamentoAutomaticoHorario] = useState("23:59");

  const [resumoDiario, setResumoDiario] = useState<ResumoCaixaDiario | null>(null);
  const [fechamentos, setFechamentos] = useState<ItemHistoricoFechamento[]>([]);
  const [carregandoFechamento, setCarregandoFechamento] = useState(false);

  const [valorContadoTexto, setValorContadoTexto] = useState("");
  const [observacaoTexto, setObservacaoTexto] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let ativo = true;

    const iniciar = async () => {
      try {
        setCarregandoStatus(true);
        const status = await verificarStatusCaixa();
        if (!ativo) return;
        setCaixaAberto(status);

        if (status) {
          try {
            setCarregandoResumoSessao(true);
            const resumo = await obterResumoSessaoAbertaDetalhado();
            if (ativo) setResumoSessao(resumo);
          } catch (erro) {
            if (!ativo) return;
            const mensagem = erro instanceof Error ? erro.message : "Não foi possível carregar o resumo do caixa.";
            toast.error(mensagem);
          } finally {
            if (ativo) setCarregandoResumoSessao(false);
          }
        }
      } catch (erro) {
        if (!ativo) return;
        const mensagem = erro instanceof Error ? erro.message : "Não foi possível verificar o status do caixa.";
        toast.error(mensagem);
      } finally {
        if (ativo) setCarregandoStatus(false);
      }
    };

    iniciar();

    obterConfiguracoes()
      .then((config) => {
        if (!ativo) return;
        setFechamentoAutomaticoAtivo(Boolean(config.fechamentoAutomaticoCaixaAtivo));
        setFechamentoAutomaticoHorario(config.fechamentoAutomaticoCaixaHorario || "23:59");
      })
      .catch(() => {
        // Sem a config, o aviso de fechamento automático so fica oculto — nao impede o uso da tela.
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (aba !== "fechamento" || !caixaAberto) return;

    let ativo = true;

    const carregar = async () => {
      try {
        setCarregandoFechamento(true);
        const [diario, historico] = await Promise.all([obterResumoCaixaDiario(), obterHistoricoFechamentos(1, 5)]);
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
  }, [aba, caixaAberto]);

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
        />
      )}
    </div>
  );
}
