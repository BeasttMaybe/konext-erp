"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import { obterDadosPerfilConfiguracao } from "@/app/actions/configuracoes";
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

const PERMISSOES_CONFIGURACOES = ["configuracoes.empresa", "configuracoes.sistema", "configuracoes.usuarios"] as const;

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "K";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

/**
 * Barra superior do app shell (Fase 3-1, Parte 3) — nome da empresa, campo
 * de busca global (abre a paleta de comando via Ctrl+K, ver
 * paleta-comando.tsx), notificações e menu do usuário. Lógica de
 * logout/perfil/tema portada de components/layout/cabecalho.tsx (Fase 1B) —
 * mesmo comportamento, shell novo.
 */
export function BarraSuperior({ onAbrirBusca }: { onAbrirBusca: () => void }) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { papel } = usePermissoes();
  const podeVerConfiguracoes = useTemAlgumaPermissao(PERMISSOES_CONFIGURACOES);
  const [nomeUsuario, setNomeUsuario] = useState("Usuario Konext");
  const [emailUsuario, setEmailUsuario] = useState("usuario@konext.local");
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("Konext");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [falhaLogo, setFalhaLogo] = useState(false);
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    let ativo = true;

    obterDadosPerfilConfiguracao()
      .then((dados) => {
        if (!ativo) return;
        setNomeUsuario(dados.usuario?.nome || "Usuario Konext");
        setEmailUsuario(dados.usuario?.email || "usuario@konext.local");
        setFotoPerfilUrl(dados.usuario?.fotoPerfilUrl || null);
        setNomeEmpresa(dados.configuracao?.nomeFantasia || "Konext");
        setLogoUrl(dados.configuracao?.logoUrl || null);
      })
      .catch(() => {
        // Mantém os valores padrão — a barra não pode quebrar a tela por causa do perfil.
      });

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-kx-cabecalho flex h-[72px] shrink-0 items-center gap-3 border-b border-kx-painel-borda bg-kx-painel px-4 lg:px-6">
      <GavetaLateralMobile />

      {/* Nome da empresa (dado do tenant, pode ser diferente de "Konext"):
          só o texto, mais o logo QUANDO ele existir — nunca uma caixa vazia
          no lugar dele. A marca "Konext" + tagline fica só na barra
          lateral (Fase 3-2C, Parte 2). */}
      <span className="hidden shrink-0 items-center gap-2 lg:flex">
        {logoUrl && !falhaLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL de logo enviada pelo tenant, fora do domínio otimizado pelo next/image.
          <img
            src={logoUrl}
            alt={`Logo ${nomeEmpresa}`}
            className="h-8 w-8 shrink-0 rounded-kx-botao border border-kx-painel-borda bg-kx-superficie object-contain p-1"
            onError={() => setFalhaLogo(true)}
          />
        ) : null}
        <span className="text-sm font-semibold text-kx-texto">{nomeEmpresa}</span>
      </span>

      <button
        type="button"
        onClick={onAbrirBusca}
        className="ml-2 flex h-10 flex-1 max-w-[460px] items-center gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 text-sm text-kx-placeholder transition-colors hover:border-kx-foco lg:ml-4"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Buscar OS, cliente...</span>
        <kbd className="hidden shrink-0 rounded border border-kx-campo-borda bg-kx-cartao px-1.5 py-0.5 text-[10px] font-medium text-kx-legenda sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {montado && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        )}

        <SinoNotificacoes />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
              <Avatar className="h-10 w-10">
                <AvatarImage src={fotoPerfilUrl ?? undefined} alt={nomeUsuario} />
                <AvatarFallback>{iniciaisDoNome(nomeUsuario)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[10rem] flex-col items-start sm:flex">
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
    </header>
  );
}
