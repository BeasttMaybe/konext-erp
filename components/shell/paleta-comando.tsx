"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buscarGlobal, type ResultadoBuscaGlobal } from "@/app/actions/busca-global";

const VAZIO: ResultadoBuscaGlobal = { ordens: [], clientes: [] };

type PropsPaletaComando = {
  aberta: boolean;
  onAbertaChange: (aberta: boolean) => void;
};

/**
 * Paleta de comando (Fase 3-1, Parte 3) — controlada de fora (ver
 * ShellDashboard, que liga o Ctrl+K/Cmd+K e o botão de busca da barra
 * superior no mesmo estado). Cobre OS e clientes (ver
 * app/actions/busca-global.ts pro porquê de não cobrir produto ainda).
 */
export function PaletaComando({ aberta, onAbertaChange }: PropsPaletaComando) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<ResultadoBuscaGlobal>(VAZIO);
  const [buscando, setBuscando] = useState(false);

  const termoValido = termo.trim().length >= 2;

  useEffect(() => {
    if (!termoValido) {
      return;
    }

    const temporizador = setTimeout(() => {
      setBuscando(true);
      buscarGlobal(termo)
        .then((resposta) => {
          if (!resposta.sucesso) {
            toast.error(resposta.erro);
            setResultado(VAZIO);
            return;
          }
          setResultado(resposta.dados);
        })
        .finally(() => setBuscando(false));
    }, 250);

    return () => clearTimeout(temporizador);
  }, [termo, termoValido]);

  const irPara = (caminho: string) => {
    onAbertaChange(false);
    setTermo("");
    router.push(caminho);
  };

  const resultadoExibido = termoValido ? resultado : VAZIO;
  const semResultado = !buscando && resultadoExibido.ordens.length === 0 && resultadoExibido.clientes.length === 0;

  return (
    <CommandDialog open={aberta} onOpenChange={onAbertaChange} titulo="Busca global">
      <CommandInput
        placeholder="Buscar OS por número, cliente ou equipamento..."
        value={termo}
        onValueChange={setTermo}
      />
      <CommandList>
        {!termoValido ? (
          <CommandEmpty>Digite pelo menos 2 caracteres.</CommandEmpty>
        ) : semResultado ? (
          <CommandEmpty>Nenhum resultado para &quot;{termo}&quot;.</CommandEmpty>
        ) : null}

        {resultadoExibido.ordens.length > 0 && (
          <CommandGroup heading="Ordens de serviço">
            {resultadoExibido.ordens.map((os) => (
              <CommandItem key={os.id} value={`os-${os.id}`} onSelect={() => irPara(`/os/${os.id}`)}>
                <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate">
                  <span className="font-medium">OS {os.numeroOs}</span> · {os.cliente} · {os.equipamento}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {resultadoExibido.clientes.length > 0 && (
          <CommandGroup heading="Clientes">
            {resultadoExibido.clientes.map((cliente) => (
              <CommandItem
                key={cliente.id}
                value={`cliente-${cliente.id}`}
                onSelect={() => irPara(`/crm/contatos`)}
              >
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate">
                  {cliente.nome} · {cliente.documento}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
