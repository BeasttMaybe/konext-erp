"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { CelularConectado } from "@/lib/ferramentas/adb-no-navegador";

/** As bibliotecas de USB/ADB só carregam quando alguém clica em conectar. */
export const carregarAdb = () => import("@/lib/ferramentas/adb-no-navegador");

type Estado = "DESCONECTADO" | "CONECTANDO" | "CONECTADO";

/**
 * Conexão com o celular pelo cabo, compartilhada pelas ferramentas de
 * bancada (armazenamento, limpeza de apps). Cuida de conectar, soltar ao sair
 * da tela e avisar quando o cabo é puxado.
 */
export function useConexaoCelular() {
  const ref = useRef<CelularConectado | null>(null);
  const [estado, setEstado] = useState<Estado>("DESCONECTADO");
  const [celular, setCelular] = useState<Omit<CelularConectado, "adb"> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [suporte, setSuporte] = useState<boolean | null>(null);

  useEffect(() => {
    void carregarAdb().then((m) => setSuporte(m.webUsbDisponivel()));
    return () => {
      void carregarAdb().then((m) => m.desconectar(ref.current));
    };
  }, []);

  const conectar = async (): Promise<CelularConectado | null> => {
    setErro(null);
    setEstado("CONECTANDO");
    try {
      const m = await carregarAdb();
      if (!m.webUsbDisponivel()) {
        setErro("Este navegador não acessa USB. Use o Chrome ou o Edge do computador.");
        setEstado("DESCONECTADO");
        return null;
      }
      const conectado = await m.conectarCelular();
      if (!conectado) {
        setEstado("DESCONECTADO");
        return null;
      }
      ref.current = conectado;
      setCelular({ fabricante: conectado.fabricante, modelo: conectado.modelo, android: conectado.android, serial: conectado.serial });
      setEstado("CONECTADO");
      void conectado.adb.disconnected.then(() => {
        if (ref.current === conectado) {
          ref.current = null;
          setCelular(null);
          setEstado("DESCONECTADO");
          toast.info("Celular desconectado.");
        }
      });
      return conectado;
    } catch (falha) {
      setEstado("DESCONECTADO");
      const m = await carregarAdb();
      if (falha instanceof m.ErroDeConexao) setErro(falha.message);
      else if (!(falha instanceof DOMException && falha.name === "NotFoundError")) {
        setErro("Não foi possível conectar. Desbloqueie o celular, aceite o \"Permitir depuração USB\" e tente de novo.");
      }
      return null;
    }
  };

  const desconectar = async () => {
    const m = await carregarAdb();
    const atual = ref.current;
    ref.current = null;
    await m.desconectar(atual);
    setCelular(null);
    setEstado("DESCONECTADO");
  };

  return { ref, estado, celular, erro, setErro, suporte, conectar, desconectar };
}
