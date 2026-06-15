"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { buscarClientesOS, buscarClientePorId, type ClienteBuscaOS } from "@/app/actions/os";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, User, Smartphone, Hash, KeyRound, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AbaEntradaEquipamentoProps {
  /** Quando fornecido, o seletor de cliente é pré-preenchido automaticamente via busca por ID. */
  clienteIdInicial?: string;
  /** Quando fornecido, o campo de busca de cliente inicia com este texto. */
  clienteNomeInicial?: string;
}

export function AbaEntradaEquipamento({
  clienteIdInicial,
  clienteNomeInicial,
}: AbaEntradaEquipamentoProps) {
  const { register, setValue, watch, formState: { errors } } = useFormContext();
  const [mostrarSenhaAcesso, setMostrarSenhaAcesso] = useState(false);
  const [padraoDesenho, setPadraoDesenho] = useState<number[]>([]);
  const [buscaCliente, setBuscaCliente] = useState(clienteNomeInicial ?? "");
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteBuscaOS[]>([]);
  const [clienteSelecionadoTexto, setClienteSelecionadoTexto] = useState("");
  const clienteIdAtual = watch("clienteId");
  const relatoAtual = watch("relatoCliente");
  const isClienteCompleto = Boolean(clienteIdAtual);
  const isChecklistCompleto = Boolean(relatoAtual?.trim());

  const selecionarCliente = (cliente: ClienteBuscaOS) => {
    setValue("clienteId", cliente.id, { shouldValidate: true, shouldDirty: true });
    setClienteSelecionadoTexto(`${cliente.nomeRazaoSocial} - ${cliente.documento} - ${cliente.telefone}`);
  };

  // Pré-preenche o cliente quando um clienteIdInicial é fornecido via URL
  useEffect(() => {
    if (!clienteIdInicial) return;
    let ativo = true;

    buscarClientePorId(clienteIdInicial).then((cliente) => {
      if (!ativo || !cliente) return;
      selecionarCliente(cliente);
      setBuscaCliente(cliente.nomeRazaoSocial);
    });

    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteIdInicial]);

  useEffect(() => {
    if (!clienteNomeInicial) return;
    setBuscaCliente(clienteNomeInicial);
  }, [clienteNomeInicial]);

  useEffect(() => {
    const termo = buscaCliente.trim();
    if (termo.length < 2) return;

    let ativo = true;

    const timer = setTimeout(async () => {
      try {
        const clientes = await buscarClientesOS(termo);
        if (!ativo) return;
        setClientesEncontrados(clientes);
      } catch {
        if (ativo) setClientesEncontrados([]);
      }
    }, 350);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [buscaCliente]);

  const handleBuscaClienteChange = (valor: string) => {
    setBuscaCliente(valor);

    if (valor.trim().length < 2) {
      setClientesEncontrados([]);
    }
  };

  const handleSelecionarPontoDesenho = (ponto: number) => {
    setPadraoDesenho((atual) => {
      if (atual.includes(ponto)) return atual;
      const atualizado = [...atual, ponto];
      setValue("senhaDesenho", atualizado.join("-"), { shouldValidate: true, shouldDirty: true });
      return atualizado;
    });
  };

  const handleLimparDesenho = () => {
    setPadraoDesenho([]);
    setValue("senhaDesenho", "", { shouldValidate: true, shouldDirty: true });
  };

  const obterOrdemPonto = (ponto: number): number => {
    const indice = padraoDesenho.indexOf(ponto);
    return indice >= 0 ? indice + 1 : 0;
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-muted/30 p-4 transition-all duration-200 hover:shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Dados do Cliente</h3>
          <Badge variant={isClienteCompleto ? "default" : "secondary"} className="ml-auto">
            {isClienteCompleto ? "Concluído" : "Pendente"}
          </Badge>
        </div>

        <div className="space-y-3">
          <input type="hidden" {...register("clienteId")} />
          <Label htmlFor="busca-cliente">Cliente *</Label>
          <Input
            id="busca-cliente"
            value={buscaCliente}
            onChange={(evento) => handleBuscaClienteChange(evento.target.value)}
            placeholder="Digite nome, CPF/CNPJ ou telefone"
            className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
          />

          {clienteSelecionadoTexto && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Cliente selecionado: {clienteSelecionadoTexto}
            </p>
          )}

          <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0 max-h-48 overflow-y-auto">
            {buscaCliente.trim().length < 2 && (
              <p className="p-3 text-xs text-slate-500">Digite ao menos 2 caracteres para buscar.</p>
            )}

            {buscaCliente.trim().length >= 2 && clientesEncontrados.length === 0 && (
              <p className="p-3 text-xs text-slate-500">Nenhum cliente encontrado.</p>
            )}

            {clientesEncontrados.map((cliente) => (
              <button
                key={cliente.id}
                type="button"
                onClick={() => selecionarCliente(cliente)}
                className="w-full text-left px-3 py-2 border-b last:border-b-0 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{cliente.nomeRazaoSocial}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">CPF/CNPJ: {cliente.documento}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Telefone: {cliente.telefone}</p>
              </button>
            ))}
          </Card>

          {errors.clienteId && (
            <p className="text-xs text-red-500">{String(errors.clienteId.message)}</p>
          )}
        </div>
      </Card>

      <Card className="border-border/70 bg-muted/30 p-4 transition-all duration-200 hover:shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Dados do Aparelho</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="marca" className="flex items-center gap-2">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              Marca
            </Label>
            <Input
              id="marca"
              placeholder="Ex: Apple, Samsung, Dell"
              className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
              {...register("marca")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelo" className="flex items-center gap-2">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              Modelo
            </Label>
            <Input
              id="modelo"
              placeholder="Ex: iPhone 13 Pro"
              className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
              {...register("modelo")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imei" className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              IMEI / Nº de Série
            </Label>
            <Input
              id="imei"
              placeholder="Ex: 358123045237847"
              className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
              {...register("imei")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha" className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Senha do Aparelho
            </Label>
            <div className="relative">
              <Input
                id="senha"
                type={mostrarSenhaAcesso ? "text" : "password"}
                placeholder="••••••••"
                className="pr-11 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
                {...register("senha")}
              />
              <button
                type="button"
                onClick={() => setMostrarSenhaAcesso((atual) => !atual)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={mostrarSenhaAcesso ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenhaAcesso ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border/70 bg-background/80 p-4 sm:p-5">
          <input type="hidden" {...register("senhaDesenho")} />

          <div className="mb-3 text-center">
            <Label className="text-sm font-semibold text-foreground">Senha de Desenho (Android)</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Toque nos pontos na ordem para registrar o padrão de desbloqueio.
            </p>
          </div>

          <div className="mx-auto grid w-[216px] grid-cols-3 gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
            {Array.from({ length: 9 }, (_, indice) => indice + 1).map((ponto) => {
              const ordem = obterOrdemPonto(ponto);
              const selecionado = ordem > 0;

              return (
                <button
                  key={ponto}
                  type="button"
                  onClick={() => handleSelecionarPontoDesenho(ponto)}
                  className={`relative h-12 w-12 rounded-full border transition-all ${
                    selecionado
                      ? "scale-105 border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  {ordem > 0 && (
                    <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-emerald-600 text-[10px] font-bold leading-5 text-white">
                      {ordem}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Padrão:</span>{" "}
              {padraoDesenho.length > 0 ? padraoDesenho.join("-") : "Não definido"}
            </div>
            <Button type="button" variant="outline" onClick={handleLimparDesenho}>
              Limpar Desenho
            </Button>
          </div>

          {padraoDesenho.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {padraoDesenho.map((ponto, indice) => (
                <Badge
                  key={`${ponto}-${indice}`}
                  variant="secondary"
                  className="bg-slate-200 dark:bg-slate-700"
                >
                  {indice + 1}º ponto: {ponto}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="border-border/70 bg-muted/30 p-4 transition-all duration-200 hover:shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Checklist de Entrada</h3>
          <Badge variant={isChecklistCompleto ? "default" : "secondary"} className="ml-auto">
            {isChecklistCompleto ? "Concluído" : "Pendente"}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="relatoCliente">Relato do Cliente *</Label>
            <Textarea
              id="relatoCliente"
              placeholder="Descreva o que o cliente informou sobre o problema..."
              rows={3}
              className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
              {...register("relatoCliente")}
            />
            {errors.relatoCliente && (
              <p className="text-xs text-red-500">
                {String(errors.relatoCliente.message)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="condicaoFisica">Condição Física</Label>
            <Textarea
              id="condicaoFisica"
              placeholder="Ex: Arranhões, tela trincada, bateria inchada..."
              rows={2}
              className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
              {...register("condicaoFisica")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acessorios">Acessórios Deixados</Label>
            <Textarea
              id="acessorios"
              placeholder="Ex: Carregador original, capinha, EarPods..."
              rows={2}
              className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/35"
              {...register("acessorios")}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
