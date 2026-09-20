"use client";

import { useEffect, useState } from "react";
import { buscarClientesCRM, type ClienteBuscaCRM } from "@/app/actions/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SeletorClienteCRMProps {
  label: string;
  clienteSelecionado: ClienteBuscaCRM | null;
  onSelecionarCliente: (cliente: ClienteBuscaCRM) => void;
  onLimparCliente: () => void;
  papelFiltro?: "CLIENTE" | "FORNECEDOR" | "TODOS";
}

export function SeletorClienteCRM({
  label,
  clienteSelecionado,
  onSelecionarCliente,
  onLimparCliente,
  papelFiltro = "TODOS",
}: SeletorClienteCRMProps) {
  const [termoBusca, setTermoBusca] = useState("");
  const [resultados, setResultados] = useState<ClienteBuscaCRM[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    const buscar = async () => {
      const termo = termoBusca.trim();
      if (termo.length < 1) {
        if (ativo) {
          setResultados([]);
          setErro("");
        }
        return;
      }

      try {
        setCarregando(true);
        setErro("");
        const lista = await buscarClientesCRM(termo, papelFiltro);
        if (ativo) {
          setResultados(lista);
          if (lista.length === 0 && termo.length >= 2) {
            setErro("Nenhum cliente encontrado");
          }
        }
      } catch (erro) {
        if (ativo) {
          setResultados([]);
          setErro(erro instanceof Error ? erro.message : "Erro ao buscar clientes");
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    };

    const timer = setTimeout(() => {
      buscar();
    }, 150);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [termoBusca, papelFiltro]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={termoBusca}
          onChange={(evento) => setTermoBusca(evento.target.value)}
          placeholder="Digitar nome, CPF ou CNPJ..."
          autoComplete="off"
        />

        {carregando && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">⟳ Buscando...</p>}

        {erro && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{erro}</p>}

        {!carregando && termoBusca.trim().length >= 1 && resultados.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-kx-dropdown max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
            {resultados.map((cliente) => (
              <button
                key={cliente.id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-b-0 focus:outline-none focus:bg-accent"
                onClick={() => {
                  onSelecionarCliente(cliente);
                  setTermoBusca("");
                  setResultados([]);
                  setErro("");
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">{cliente.nomeRazaoSocial}</p>
                  <p className="text-xs text-muted-foreground">
                    {cliente.documento} {cliente.nomeFantasia ? `• ${cliente.nomeFantasia}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {clienteSelecionado && (
        <div className="rounded-md border border-border bg-muted/30 p-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{clienteSelecionado.nomeRazaoSocial}</p>
            <p className="text-xs text-muted-foreground">{clienteSelecionado.documento}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onLimparCliente();
              setTermoBusca("");
              setResultados([]);
            }}
          >
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}
