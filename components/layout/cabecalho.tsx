"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { obterDadosPerfilConfiguracao } from "@/app/actions/configuracoes";
import { logout } from "@/app/actions/auth";
import { SinoNotificacoes } from "@/components/layout/sino-notificacoes";
import { MenuMobile } from "@/components/layout/menu-mobile";
import { NavPrincipal } from "@/components/layout/nav-principal";
import { useTheme } from "@/components/provedores/provedor-tema";

/**
 * Cabeçalho único do sistema: logo, navegação principal e ações do usuário.
 */
export function Cabecalho() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [nomeUsuario, setNomeUsuario] = useState("Usuario Konext");
  const [emailUsuario, setEmailUsuario] = useState("usuario@konext.local");
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("Konext");
  const [logoEmpresa, setLogoEmpresa] = useState<string | null>(null);
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    let ativo = true;

    const carregarUsuario = async () => {
      try {
        const dados = await obterDadosPerfilConfiguracao();
        if (!ativo) return;

        setNomeUsuario(dados.usuario?.nome || "Usuario Konext");
        setEmailUsuario(dados.usuario?.email || "usuario@konext.local");
        setFotoPerfilUrl(dados.usuario?.fotoPerfilUrl || null);
        setNomeEmpresa(dados.configuracao?.nomeFantasia || "Konext");
        setLogoEmpresa(dados.configuracao?.logoUrl || null);
      } catch {
        if (!ativo) return;
        setNomeUsuario("Usuario Konext");
        setEmailUsuario("usuario@konext.local");
        setFotoPerfilUrl(null);
        setNomeEmpresa("Konext");
        setLogoEmpresa(null);
      }
    };

    carregarUsuario();

    return () => {
      ativo = false;
    };
  }, []);

  const iniciais = nomeUsuario
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background">
      <div className="flex h-14 items-center gap-2 px-4">
        <Suspense fallback={null}>
          <MenuMobile />
        </Suspense>

        <Link href="/" className="flex shrink-0 items-center gap-[11px]" aria-label={nomeEmpresa}>
          {logoEmpresa ? (
            <Image
              src={logoEmpresa}
              alt={nomeEmpresa}
              width={34}
              height={34}
              unoptimized
              className="h-[34px] w-[34px] rounded-[9px] object-contain"
            />
          ) : (
            <span
              className="grid h-[34px] w-[34px] place-items-center rounded-[9px] text-[18px] font-bold text-white"
              style={{ backgroundColor: "var(--receita)" }}
            >
              {nomeEmpresa.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="hidden text-[19px] font-semibold tracking-[-0.01em] text-foreground sm:inline-block">
            {nomeEmpresa}
          </span>
        </Link>

        <Suspense fallback={<div className="hidden lg:block" />}>
          <NavPrincipal />
        </Suspense>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SinoNotificacoes />

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={fotoPerfilUrl || undefined} alt={nomeUsuario} />
                  <AvatarFallback>{iniciais || "UK"}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline-block">
                  {nomeUsuario}
                </span>
                <ChevronDown aria-hidden="true" className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium text-foreground">{nomeUsuario}</p>
                <p className="text-xs text-muted-foreground">{emailUsuario}</p>
              </div>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2"
                onSelect={() => router.push("/perfil")}
              >
                <User className="h-4 w-4" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2"
                onSelect={() => router.push("/configuracoes")}
              >
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2 text-red-600 dark:text-red-400"
                onSelect={() => {
                  void logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
