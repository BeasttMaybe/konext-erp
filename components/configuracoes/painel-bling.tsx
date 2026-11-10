"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Link2, Loader2, Plug, Unplug } from "lucide-react";
import { toast } from "sonner";

import {
  desconectarBling,
  espiarRespostaDoBling,
  obterEstadoDaIntegracaoBling,
  type EstadoDaIntegracaoBling,
} from "@/app/actions/bling";
import { Button } from "@/components/ui/button";

/**
 * Conexão com o Bling.
 *
 * A URL de redirecionamento aparece pronta, com botão de copiar, pela mesma
 * razão do "procurar meu chat" do Telegram: ela precisa bater EXATAMENTE com
 * o que foi cadastrado no aplicativo do Bling, e uma barra a mais faz o Bling
 * recusar a autorização sem explicar o motivo. Montar esse endereço à mão é
 * um erro esperando para acontecer.
 */
export function PainelBling() {
  const [estado, setEstado] = useState<EstadoDaIntegracaoBling | null>(null);
  const [amostra, setAmostra] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [desconectando, iniciarDesconexao] = useTransition();
  const [espiando, iniciarEspiada] = useTransition();

  function recarregar() {
    void obterEstadoDaIntegracaoBling()
      .then(setEstado)
      .catch(() => toast.error("Não foi possível ler o estado da integração."))
      .finally(() => setCarregando(false));
  }

  useEffect(recarregar, []);

  function copiarUrl() {
    if (!estado?.urlDeRedirecionamento) return;

    void navigator.clipboard
      .writeText(estado.urlDeRedirecionamento)
      .then(() => toast.success("Endereço copiado. Cole no campo “Link de redirecionamento”."))
      .catch(() => toast.error("Não consegui copiar. Selecione o texto e copie à mão."));
  }

  function desconectarAgora() {
    iniciarDesconexao(async () => {
      const resultado = await desconectarBling();

      if (resultado.sucesso) {
        toast.success(resultado.mensagem);
        recarregar();
      } else {
        toast.error(resultado.mensagem);
      }
    });
  }

  function espiar(recurso: "nfe" | "contas" | "nfe-detalhe" | "conta-detalhe" | "bordero") {
    iniciarEspiada(async () => {
      const resultado = await espiarRespostaDoBling(recurso);

      if (resultado.sucesso) {
        setAmostra(`${resultado.recurso}\n\n${resultado.amostra}`);
        toast.success("Resposta recebida.");
      } else {
        setAmostra(null);
        toast.error(resultado.mensagem);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Plug className="mt-0.5 h-5 w-5 shrink-0 text-kx-primaria" aria-hidden />
        <div>
          <h3 className="text-base font-bold text-kx-texto">Bling</h3>
          <p className="mt-0.5 text-sm text-kx-legenda">
            Você continua emitindo as notas no Bling. O Konext apenas lê o que foi emitido e
            traz para cá. <strong className="text-kx-texto-2">Nada é emitido, cancelado ou
            alterado no Bling</strong> — a autorização pedida é só de leitura.
          </p>
        </div>
      </div>

      {estado && !estado.configuradoNoAmbiente && (
        <p className="rounded-kx-painel border border-kx-alerta-borda bg-kx-alerta-fundo px-3 py-2 text-sm text-kx-alerta-texto">
          As credenciais do aplicativo (BLING_CLIENT_ID e BLING_CLIENT_SECRET) ainda não estão
          no ambiente. Sem elas não é possível conectar.
        </p>
      )}

      <div className="space-y-2">
        <span className="text-sm font-semibold text-kx-texto">Link de redirecionamento</span>
        <p className="text-xs text-kx-legenda">
          Este é o endereço que vai no campo “Link de redirecionamento” do aplicativo, lá no
          Bling. Ele precisa bater exatamente — uma barra a mais e a conexão é recusada.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-kx-painel border border-kx-painel-borda bg-kx-superficie px-3 py-2 text-xs text-kx-texto-2">
            {estado?.urlDeRedirecionamento || "—"}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copiarUrl}
            disabled={!estado?.urlDeRedirecionamento}
          >
            <Copy className="h-4 w-4" aria-hidden />
            <span className="sr-only">Copiar endereço</span>
          </Button>
        </div>
      </div>

      <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-superficie px-4 py-3">
        {carregando ? (
          <p className="text-sm text-kx-legenda">Verificando…</p>
        ) : estado?.conectado ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-kx-texto">Conectado</p>
              <p className="text-xs text-kx-legenda">
                {estado.ultimaSincronizacaoEm
                  ? `Última leitura: ${new Date(estado.ultimaSincronizacaoEm).toLocaleString("pt-BR")}`
                  : "Ainda não buscou notas."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={desconectarAgora}
              disabled={desconectando}
            >
              {desconectando ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Unplug className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-kx-legenda">Nenhuma conta do Bling conectada.</p>
            <Button asChild disabled={!estado?.configuradoNoAmbiente}>
              {/* Link de verdade, não botão com fetch: o fim deste fluxo é o
                  navegador sair para o domínio do Bling. */}
              <a href="/api/integracoes/bling/conectar">
                <Link2 className="mr-1.5 h-4 w-4" aria-hidden />
                Conectar conta do Bling
              </a>
            </Button>
          </div>
        )}
      </div>

      {estado?.ultimoErro && (
        <p className="rounded-kx-painel border border-kx-alerta-borda bg-kx-alerta-fundo px-3 py-2 text-xs text-kx-alerta-texto">
          Última falha: {estado.ultimoErro}
        </p>
      )}

      {estado?.conectado && (
        <div className="space-y-2 border-t border-kx-painel-borda pt-4">
          <span className="text-sm font-semibold text-kx-texto">Conferir a conexão</span>
          <p className="text-xs text-kx-legenda">
            Busca um registro e mostra como o Bling respondeu. Serve para confirmar que a
            autorização funcionou e para diagnosticar, se um dia o Bling mudar alguma coisa.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={espiando} onClick={() => espiar("nfe")}>
              {espiando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Ver uma nota fiscal
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={espiando} onClick={() => espiar("contas")}>
              {espiando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Ver uma conta a receber
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={espiando} onClick={() => espiar("nfe-detalhe")}>
              {espiando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Ver o detalhe de uma nota
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={espiando} onClick={() => espiar("conta-detalhe")}>
              {espiando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Ver o detalhe de uma conta já recebida
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={espiando} onClick={() => espiar("bordero")}>
              {espiando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Ver o borderô (lote de baixa)
            </Button>
          </div>

          {amostra && (
            <pre className="max-h-80 overflow-auto rounded-kx-painel border border-kx-painel-borda bg-kx-superficie p-3 text-[11px] leading-relaxed text-kx-texto-2">
              {amostra}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
