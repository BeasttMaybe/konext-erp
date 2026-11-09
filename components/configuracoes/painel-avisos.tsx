"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";

import {
  enviarAvisoDeTeste,
  obterConfiguracaoDeAvisos,
  procurarChatsDoTelegram,
  salvarConfiguracaoDeAvisos,
} from "@/app/actions/avisos-telegram";
import type { ChatEncontrado } from "@/lib/notificacoes/telegram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Avisos de vencimento no Telegram.
 *
 * O botão de teste é a peça central deste painel, pela mesma razão do painel
 * de armazenamento de fotos: o projeto não tem ambiente de Preview, então a
 * primeira vez que o código fala com o Telegram é em produção. Descobrir ali
 * que o chat id está errado é descobrir no dia em que um boleto venceu sem
 * aviso — e aí já não dá pra consertar.
 *
 * O token do bot não aparece aqui e não tem como aparecer: ele é segredo de
 * ambiente, entra como Secret na Vercel e nem o dono consegue lê-lo de volta.
 * O que este painel mostra é só se ele EXISTE, pra que a tela possa dizer a
 * verdade — sem isso, um dono que colasse o chat id e não recebesse nada não
 * saberia se errou o id ou se o bot ainda não foi ligado.
 */
export function PainelAvisos() {
  const [chatId, setChatId] = useState("");
  const [ligado, setLigado] = useState(true);
  const [tokenConfigurado, setTokenConfigurado] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, iniciarSalvar] = useTransition();
  const [testando, iniciarTeste] = useTransition();
  const [procurando, iniciarProcura] = useTransition();
  const [chatsEncontrados, setChatsEncontrados] = useState<ChatEncontrado[] | null>(null);

  useEffect(() => {
    let ativo = true;

    void obterConfiguracaoDeAvisos()
      .then((dados) => {
        if (!ativo) return;
        setChatId(dados.chatId);
        setLigado(dados.ligado);
        setTokenConfigurado(dados.tokenConfigurado);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível ler a configuração dos avisos.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  function salvar() {
    iniciarSalvar(async () => {
      const resultado = await salvarConfiguracaoDeAvisos({ chatId, ligado });

      if (resultado.sucesso) toast.success(resultado.mensagem);
      else toast.error(resultado.mensagem);
    });
  }

  function procurar() {
    iniciarProcura(async () => {
      const resultado = await procurarChatsDoTelegram();

      if (!resultado.sucesso) {
        setChatsEncontrados(null);
        toast.error(resultado.mensagem);
        return;
      }

      setChatsEncontrados(resultado.chats);

      if (resultado.chats.length === 0) {
        toast.info("Nenhuma conversa encontrada. Mande uma mensagem pro bot no Telegram e procure de novo.");
      }
    });
  }

  function testar() {
    iniciarTeste(async () => {
      const resultado = await enviarAvisoDeTeste();

      if (resultado.sucesso) toast.success(resultado.mensagem);
      else toast.error(resultado.mensagem);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-kx-primaria" aria-hidden />
        <div>
          <h3 className="text-base font-bold text-kx-texto">Avisos de vencimento</h3>
          <p className="mt-0.5 text-sm text-kx-legenda">
            Conta a pagar e a receber avisadas três dias antes do vencimento, depois dois, um
            e no próprio dia. Os avisos sempre aparecem no sininho do sistema; aqui você
            escolhe se eles também chegam no Telegram.
          </p>
        </div>
      </div>

      {tokenConfigurado === false && (
        <p className="rounded-kx-painel border border-kx-alerta-borda bg-kx-alerta-fundo px-3 py-2 text-sm text-kx-alerta-texto">
          O bot do Telegram ainda não foi ligado no ambiente. Enquanto isso, nenhum aviso sai
          por lá — os do sininho continuam normalmente.
        </p>
      )}

      <div className="flex items-center justify-between gap-4 rounded-kx-painel border border-kx-painel-borda bg-kx-superficie px-4 py-3">
        <div>
          <Label htmlFor="avisos-ligado" className="text-sm font-semibold text-kx-texto">
            Receber no Telegram
          </Label>
          <p className="mt-0.5 text-xs text-kx-legenda">
            Desligar aqui não apaga o chat configurado.
          </p>
        </div>
        <Switch
          id="avisos-ligado"
          checked={ligado}
          disabled={carregando}
          onCheckedChange={setLigado}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="chat-id">Chat do Telegram</Label>
        <Input
          id="chat-id"
          value={chatId}
          disabled={carregando}
          onChange={(evento) => setChatId(evento.target.value)}
          placeholder="Ex.: 123456789"
          inputMode="text"
        />
        <p className="text-xs text-kx-legenda">
          Mande qualquer mensagem pro bot no Telegram e clique em “Procurar meu chat” — ele
          acha o número sozinho. Deixe em branco para não receber por lá.
        </p>
      </div>

      {/* A lista existe pra que ninguém precise caçar o número e colar às
          cegas. Foi exatamente assim que a primeira configuração saiu errada:
          com o id do próprio bot, que vem no começo do token. */}
      {chatsEncontrados !== null && chatsEncontrados.length > 0 && (
        <div className="space-y-2 rounded-kx-painel border border-kx-painel-borda bg-kx-superficie p-3">
          <p className="text-xs font-semibold text-kx-texto-2">
            Conversas que falaram com o bot. Clique na sua:
          </p>
          <div className="flex flex-col gap-1.5">
            {chatsEncontrados.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => {
                  setChatId(chat.id);
                  toast.success("Número preenchido. Salve e mande o teste.");
                }}
                className="flex items-center justify-between gap-3 rounded-kx-pilula border border-kx-painel-borda px-3 py-2 text-left text-sm transition-colors hover:border-kx-destaque"
              >
                <span className="font-semibold text-kx-texto">{chat.nome}</span>
                <span className="text-xs text-kx-legenda">
                  {chat.tipo === "private" ? "conversa direta" : "grupo"} · {chat.id}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={salvar} disabled={carregando || salvando}>
          {salvando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
          Salvar destino
        </Button>

        <Button type="button" variant="outline" onClick={procurar} disabled={carregando || procurando}>
          {procurando ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Search className="mr-1.5 h-4 w-4" aria-hidden />
          )}
          Procurar meu chat
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={testar}
          disabled={carregando || testando || chatId.trim() === ""}
        >
          {testando ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="mr-1.5 h-4 w-4" aria-hidden />
          )}
          Mandar mensagem de teste
        </Button>
      </div>

      <p className="text-xs text-kx-legenda">
        Conta já vencida não é avisada de novo todo dia: depois do atraso, quem mostra é a
        própria tela, em vermelho, até alguém resolver. Repetir no celular todas as manhãs
        faria você silenciar o bot — e perder os avisos que importam.
      </p>
    </div>
  );
}
