"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import { usePerfilDaMoldura } from "@/contextos/contexto-perfil";
import { logout } from "@/app/actions/auth";
import { useTheme } from "@/components/provedores/provedor-tema";
import { useTemAlgumaPermissao, usePermissoes } from "@/contextos/contexto-permissoes";
import { rotularPapel } from "@/lib/auth/permissoes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SinoNotificacoes } from "@/components/layout/sino-notificacoes";
import { GavetaLateralMobile } from "./gaveta-lateral-mobile";
import { NavegacaoTopo } from "./navegacao-topo";
import { StatusCaixa } from "./status-caixa";
import { BotaoLerQrDaOS } from "./botao-ler-qr-os";

const PERMISSOES_CONFIGURACOES = ["configuracoes.empresa", "configuracoes.sistema", "configuracoes.usuarios"] as const;

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "U";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

/** Nome do usuário para exibir; se não houver nome cadastrado, usa a parte
 * local do e-mail — nunca o nome da empresa. */
function nomeOuEmail(nome: string | null | undefined, email: string): string {
  const nomeLimpo = nome?.trim();
  if (nomeLimpo) return nomeLimpo;
  const [parteLocal] = email.split("@");
  return parteLocal || email;
}

/** Marca da loja no canto esquerdo do cabeçalho — logo do tenant (ou um "T"
 * de fallback) + nome. Clica e vai pro Dashboard. Antes vivia na barra
 * lateral; no redesenho de topo (11/2026) a marca encabeça a primeira linha. */
function MarcaDaLoja() {
  const { logoUrl, nomeDaLoja } = usePerfilDaMoldura();
  const [falhaLogo, setFalhaLogo] = useState(false);

  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={nomeDaLoja || "TechOS"}>
      {logoUrl && !falhaLogo ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-kx-botao bg-kx-papel">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL de logo enviada pelo tenant, fora do domínio otimizado pelo next/image. */}
          <img src={logoUrl} alt="Logo da empresa" className="h-full w-full object-contain" onError={() => setFalhaLogo(true)} />
        </span>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-kx-botao bg-kx-primaria text-base font-extrabold text-primary-foreground">
          T
        </span>
      )}
      <span className="hidden min-w-0 flex-col xl:flex">
        <span className="max-w-[11rem] truncate text-sm font-extrabold leading-tight tracking-tight text-kx-texto">
          {nomeDaLoja || "TechOS"}
        </span>
        <span className="text-[11px] leading-tight text-kx-legenda">TechOS ERP</span>
      </span>
    </Link>
  );
}

/**
 * Cabeçalho do app shell (redesenho 11/2026) — barra horizontal no topo, full
 * width, no lugar da barra lateral. Duas linhas no desktop: a primeira com
 * marca, busca global (Ctrl+K, ver paleta-comando.tsx) e ações (leitor de QR,
 * status do caixa, tema, notificações, usuário); a segunda com a navegação
 * dos módulos (`NavegacaoTopo`). Abaixo de `lg` a navegação some e dá lugar à
 * gaveta (hambúrguer), e a barra fica numa linha só.
 */
export function BarraSuperior({ onAbrirBusca }: { onAbrirBusca: () => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const { papel } = usePermissoes();
  const podeVerConfiguracoes = useTemAlgumaPermissao(PERMISSOES_CONFIGURACOES);
  const perfil = usePerfilDaMoldura();
  const emailUsuario = perfil.email;
  const nomeUsuario = nomeOuEmail(perfil.nome, emailUsuario);
  const fotoPerfilUrl = perfil.fotoPerfilUrl;
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <header className="sticky top-0 z-kx-cabecalho shrink-0 border-b border-kx-painel-borda bg-kx-fora pt-[env(safe-area-inset-top)]">
      {/* No iPhone instalado como app, o sistema ocupa também a área da barra
          de status (ver `statusBarStyle` em app/layout.tsx) — daí o padding de
          cima pela safe-area; no navegador comum ela vale 0.

          Header no estilo Bling (11/2026): UMA linha, fundo escuro (--kx-fora),
          marca + navegação em texto + busca + ações. */}
      <div className="flex h-16 shrink-0 items-center gap-2 px-3 lg:gap-3 lg:px-4">
        <GavetaLateralMobile />
        <MarcaDaLoja />
        <NavegacaoTopo />

        <button
          type="button"
          onClick={onAbrirBusca}
          aria-label="Buscar OS, cliente..."
          className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie text-sm text-kx-placeholder transition-colors hover:border-kx-foco sm:ml-2 sm:w-auto sm:max-w-[520px] sm:flex-1 sm:shrink sm:justify-start sm:px-3"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden flex-1 text-left sm:inline">Buscar OS, cliente...</span>
          <kbd className="hidden shrink-0 rounded border border-kx-campo-borda bg-kx-cartao px-1.5 py-0.5 text-[10px] font-medium text-kx-legenda sm:block">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BotaoLerQrDaOS />
          <div className="hidden xl:block">
            <StatusCaixa />
          </div>
          {montado && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={resolvedTheme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
              onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
            >
              {resolvedTheme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          )}

          <SinoNotificacoes />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={fotoPerfilUrl ?? undefined} alt={nomeUsuario} />
                  <AvatarFallback>{iniciaisDoNome(nomeUsuario)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[10rem] flex-col items-start xl:flex">
                  <span className="truncate text-sm font-bold leading-tight text-kx-texto">{nomeUsuario}</span>
                  <span className="truncate text-xs leading-tight text-kx-legenda">{rotularPapel(papel)}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium text-foreground">{nomeUsuario}</p>
                <p className="text-xs text-muted-foreground">{emailUsuario}</p>
              </div>
              <DropdownMenuSeparator />

              <DropdownMenuItem className="flex cursor-pointer items-center gap-2" onSelect={() => router.push("/perfil")}>
                <span>Meu Perfil</span>
              </DropdownMenuItem>
              {podeVerConfiguracoes && (
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2" onSelect={() => router.push("/configuracoes")}>
                  <span>Configurações</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2 text-destructive"
                onSelect={() => {
                  void logout();
                }}
              >
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
