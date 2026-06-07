"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  Search,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contextos/contexto-sidebar";
import { obterDadosPerfilConfiguracao } from "@/app/actions/configuracoes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/actions/auth";

/**
 * Componente do Cabeçalho (Header) do Dashboard
 */
export function Cabecalho() {
  const { theme, setTheme } = useTheme();
  const { contraida } = useSidebar();
  const router = useRouter();
  const [localizado, setLocalizado] = useState("");
  const [montado, setMontado] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState("Usuario Konext");
  const [emailUsuario, setEmailUsuario] = useState("usuario@konext.local");
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);

  // Apenas renderizar ícone de tema após hidratação completa
  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    let ativo = true;

    const carregarUsuario = async () => {
      try {
        const dados = await obterDadosPerfilConfiguracao();
        if (!ativo) return;

        setNomeUsuario(dados.usuario?.nome || "Usuario Konext");
        setEmailUsuario(dados.usuario?.email || "usuario@konext.local");
        setFotoPerfilUrl(dados.usuario?.fotoPerfilUrl || null);
      } catch {
        if (!ativo) return;
        setNomeUsuario("Usuario Konext");
        setEmailUsuario("usuario@konext.local");
        setFotoPerfilUrl(null);
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
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 bg-white dark:bg-slate-950 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between gap-4 transition-all duration-300 ease-in-out",
        contraida ? "left-20" : "left-64"
      )}
    >
      {/* Barra de Busca */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar..."
            value={localizado}
            onChange={(e) => setLocalizado(e.target.value)}
            className="pl-9 border-zinc-200 dark:border-zinc-700"
          />
        </div>
      </div>

      {/* Ações do Cabeçalho */}
      <div className="flex items-center gap-3">
        {/* Ícone de Notificação */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full" />
        </Button>

        {/* Botão de Alternância de Tema - Renderiza apenas após hidratação */}
        {montado && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Menu do Perfil */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 h-10"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={fotoPerfilUrl || undefined}
                  alt={nomeUsuario}
                />
                <AvatarFallback>{iniciais || "UK"}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline-block">
                {nomeUsuario}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Informações do Usuário */}
            <div className="px-2 py-1.5 text-sm">
              <p className="font-medium text-zinc-900 dark:text-white">
                {nomeUsuario}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {emailUsuario}
              </p>
            </div>
            <DropdownMenuSeparator />

            {/* Itens do Menu */}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onSelect={() => router.push("/perfil")}
            >
              <User className="h-4 w-4" />
              <span>Meu Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onSelect={() => router.push("/configuracoes")}
            >
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {/* Sair */}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400"
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
    </header>
  );
}
