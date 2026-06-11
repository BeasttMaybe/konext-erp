"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Tema = "light" | "dark" | "system";

type ContextoTema = {
  theme: Tema;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Tema) => void;
};

const ChaveTema = "konext-theme";

const TemaContexto = createContext<ContextoTema | null>(null);

function obterTemaSistema(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function aplicarTema(theme: Tema) {
  if (typeof document === "undefined") return;

  const temaAplicado = theme === "system" ? obterTemaSistema() : theme;
  const raiz = document.documentElement;

  raiz.classList.toggle("dark", temaAplicado === "dark");
  raiz.style.colorScheme = temaAplicado;
}

export function ProvedorTema({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Tema>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const temaSalvo = window.localStorage.getItem(ChaveTema);

    if (temaSalvo === "light" || temaSalvo === "dark" || temaSalvo === "system") {
      setThemeState(temaSalvo);
    }
  }, []);

  useEffect(() => {
    const temaEfetivo = theme === "system" ? obterTemaSistema() : theme;
    setResolvedTheme(temaEfetivo);
    aplicarTema(theme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ChaveTema, theme);
    }

    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const tratarMudancaSistema = () => {
      if (theme === "system") {
        const novoTema = obterTemaSistema();
        setResolvedTheme(novoTema);
        aplicarTema("system");
      }
    };

    media.addEventListener("change", tratarMudancaSistema);
    return () => media.removeEventListener("change", tratarMudancaSistema);
  }, [theme]);

  const contexto = useMemo<ContextoTema>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setThemeState,
    }),
    [resolvedTheme, theme]
  );

  return <TemaContexto.Provider value={contexto}>{children}</TemaContexto.Provider>;
}

export function useTheme() {
  const contexto = useContext(TemaContexto);

  if (!contexto) {
    throw new Error("useTheme deve ser usado dentro de ProvedorTema.");
  }

  return contexto;
}
