"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  contarNaoLidas,
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
  type NotificacaoItem,
} from "@/app/actions/notificacoes";

/** Formata o tempo decorrido em português (ex: "Há 2 horas") */
function formatarTempoDecorrido(data: Date): string {
  const agora = new Date();
  const diffMs = agora.getTime() - new Date(data).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Agora mesmo";
  if (diffMin < 60) return `Há ${diffMin} min`;

  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `Há ${diffHoras} hora${diffHoras > 1 ? "s" : ""}`;

  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias < 30) return `Há ${diffDias} dia${diffDias > 1 ? "s" : ""}`;

  const diffMeses = Math.floor(diffDias / 30);
  return `Há ${diffMeses} mês${diffMeses > 1 ? "es" : ""}`;
}

export function SinoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let ativo = true;

    contarNaoLidas()
      .then((total) => {
        if (!ativo) return;
        setNaoLidas(total);
      })
      .catch(() => {
        if (!ativo) return;
        setNaoLidas(0);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const aoAlterarAbertura = (proximoAberto: boolean) => {
    setAberto(proximoAberto);

    if (!proximoAberto) return;

    setCarregando(true);
    listarNotificacoes()
      .then(setNotificacoes)
      .finally(() => setCarregando(false));
  };

  const aoClicarNotificacao = (id: string) => {
    // Atualiza o estado local imediatamente para resposta instantânea
    let reduziuNaoLidas = false;

    setNotificacoes((prev) =>
      prev.map((n) => {
        if (n.id !== id || n.lida) return n;
        reduziuNaoLidas = true;
        return { ...n, lida: true };
      })
    );

    if (reduziuNaoLidas) {
      setNaoLidas((prev) => Math.max(0, prev - 1));
    }

    startTransition(() => marcarComoLida(id));
  };

  const aoMarcarTodas = () => {
    const totalNaoLidas = notificacoes.reduce(
      (total, notificacao) => total + (notificacao.lida ? 0 : 1),
      0
    );

    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    if (totalNaoLidas > 0) {
      setNaoLidas((prev) => Math.max(0, prev - totalNaoLidas));
    }
    startTransition(() => marcarTodasComoLidas());
  };

  return (
    <Popover open={aberto} onOpenChange={aoAlterarAbertura}>
      <PopoverTrigger asChild>
        {/* Botão do sino com indicador de não lidas */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 shadow-lg"
        sideOffset={8}
      >
        {/* Cabeçalho do painel */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Notificações
            </h3>
            {naoLidas > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                {naoLidas}
              </span>
            )}
          </div>

          {/* Botão "Marcar todas como lidas" */}
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              onClick={aoMarcarTodas}
              disabled={isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Lista de notificações */}
        <div className="max-h-[360px] overflow-y-auto">
          {carregando ? (
            // Estado de carregamento
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse space-y-1.5">
                  <div className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
          ) : notificacoes.length === 0 ? (
            // Estado vazio
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Nenhuma notificação no momento
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                Você está em dia!
              </p>
            </div>
          ) : (
            // Lista de itens
            <ul>
              {notificacoes.map((notif, idx) => (
                <li key={notif.id}>
                  <button
                    onClick={() => aoClicarNotificacao(notif.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors",
                      !notif.lida && "bg-blue-50/60 dark:bg-blue-900/10"
                    )}
                  >
                    {/* Indicador de não lida */}
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                        notif.lida
                          ? "bg-transparent"
                          : "bg-blue-500"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-snug truncate",
                          notif.lida
                            ? "text-zinc-600 dark:text-zinc-400 font-normal"
                            : "text-zinc-900 dark:text-zinc-100 font-semibold"
                        )}
                      >
                        {notif.titulo}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.mensagem}
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                        {formatarTempoDecorrido(notif.criadoEm)}
                      </p>
                    </div>
                  </button>

                  {/* Divisor entre itens */}
                  {idx < notificacoes.length - 1 && (
                    <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
