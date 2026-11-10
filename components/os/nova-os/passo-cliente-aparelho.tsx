"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { buscarClientesOS, buscarClientePorId, type ClienteBuscaOS } from "@/app/actions/os";
import { criarCliente } from "@/app/actions/crm";
import { ModalNovoCliente } from "@/components/crm/modal-novo-cliente";
import type { FormCliente } from "@/lib/validations/crm";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CAMPO = "h-[46px] rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 text-sm text-kx-texto placeholder:text-kx-placeholder";

/**
 * Tipo de aparelho é só visual nesta fase — não existe campo equivalente no
 * schema (OrdemServico.equipamento é um texto livre montado de marca+modelo).
 * Generalização de domínio (campo real de tipo) fica pra uma fase futura;
 * ver também o comentário em components/os/detalhe/cartao-aparelho-os.tsx.
 */
const TIPOS_APARELHO = ["Celular", "Notebook", "Console", "Outro"] as const;

interface PropsPassoClienteAparelho {
  clienteIdInicial?: string;
  clienteNomeInicial?: string;
  /** Notifica o assistente pra manter o resumo do Passo 3 atualizado. */
  onClienteSelecionado?: (nome: string) => void;
}

export function PassoClienteAparelho({ clienteIdInicial, clienteNomeInicial, onClienteSelecionado }: PropsPassoClienteAparelho) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext();

  const [buscaCliente, setBuscaCliente] = useState(clienteNomeInicial ?? "");
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteBuscaOS[]>([]);
  const [clienteSelecionadoTexto, setClienteSelecionadoTexto] = useState("");
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [tipoAparelho, setTipoAparelho] = useState<(typeof TIPOS_APARELHO)[number] | null>(null);
  const [padraoDesenho, setPadraoDesenho] = useState<number[]>([]);

  const podeCadastrarCliente = useTemPermissao("crm.editar");

  const handleBuscaClienteChange = (valor: string) => {
    setBuscaCliente(valor);
    if (valor.trim().length < 2) {
      setClientesEncontrados([]);
    }
  };

  const selecionarCliente = (cliente: ClienteBuscaOS) => {
    setValue("clienteId", cliente.id, { shouldValidate: true, shouldDirty: true });
    // Em template string, `${null}` imprime a palavra "null". Sem documento,
    // a parte some junto com o separador, em vez de virar "Fulano · null · ...".
    setClienteSelecionadoTexto(
      [cliente.nomeRazaoSocial, cliente.documento, cliente.telefone]
        .filter((parte) => Boolean(parte))
        .join(" · ")
    );
    setClientesEncontrados([]);
    onClienteSelecionado?.(cliente.nomeRazaoSocial);
  };

  useEffect(() => {
    if (!clienteIdInicial) return;
    let ativo = true;

    buscarClientePorId(clienteIdInicial).then((cliente) => {
      if (!ativo || !cliente) return;
      selecionarCliente(cliente);
      setBuscaCliente(cliente.nomeRazaoSocial);
    });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteIdInicial]);

  useEffect(() => {
    const termo = buscaCliente.trim();
    if (termo.length < 2) return;

    let ativo = true;
    const timer = setTimeout(async () => {
      try {
        const clientes = await buscarClientesOS(termo);
        if (ativo) setClientesEncontrados(clientes);
      } catch {
        if (ativo) setClientesEncontrados([]);
      }
    }, 350);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [buscaCliente]);

  const handleSalvarNovoCliente = async (dados: FormCliente): Promise<{ sucesso: boolean }> => {
    const resultado = await criarCliente(dados);

    if (!resultado.sucesso) {
      toast.error(resultado.mensagem);
      return { sucesso: false };
    }

    selecionarCliente({
      id: resultado.cliente.id,
      nomeRazaoSocial: resultado.cliente.nomeRazaoSocial,
      documento: resultado.cliente.documento,
      telefone: resultado.cliente.telefone,
    });
    setBuscaCliente(resultado.cliente.nomeRazaoSocial);
    setModalClienteAberto(false);
    toast.success("Cliente cadastrado. Já selecionado nesta OS.");
    return { sucesso: true };
  };

  const alternarPontoDesenho = (ponto: number) => {
    setPadraoDesenho((atual) => {
      if (atual.includes(ponto)) return atual;
      const atualizado = [...atual, ponto];
      setValue("senhaDesenho", atualizado.join("-"), { shouldValidate: true, shouldDirty: true });
      return atualizado;
    });
  };

  const limparDesenho = () => {
    setPadraoDesenho([]);
    setValue("senhaDesenho", "", { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-kx-cartao bg-kx-superficie p-4">
        <span className="text-sm font-bold text-kx-texto">Cliente</span>

        <div className="flex flex-col gap-1.5">
          <input type="hidden" {...register("clienteId")} />
          <Label htmlFor="busca-cliente" className="text-[13px] font-bold text-kx-texto">
            Buscar cliente <span className="text-kx-erro-icone">*</span>
          </Label>
          <Input
            id="busca-cliente"
            value={buscaCliente}
            onChange={(evento) => handleBuscaClienteChange(evento.target.value)}
            placeholder="Nome, CPF/CNPJ ou telefone"
            className={CAMPO}
          />

          {clienteSelecionadoTexto && (
            <p className="text-xs text-kx-sucesso-texto">Selecionado: {clienteSelecionadoTexto}</p>
          )}

          {clientesEncontrados.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-kx-botao border border-kx-painel-borda bg-kx-painel">
              {clientesEncontrados.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => selecionarCliente(cliente)}
                  className="w-full border-b border-kx-painel-borda px-3 py-2 text-left last:border-b-0 hover:bg-kx-cartao"
                >
                  <p className="text-sm font-semibold text-kx-texto">{cliente.nomeRazaoSocial}</p>
                  <p className="text-xs text-kx-legenda">
                    {cliente.documento} · {cliente.telefone}
                  </p>
                </button>
              ))}
            </div>
          )}

          {errors.clienteId && (
            <p className="text-xs text-kx-erro-texto">{String(errors.clienteId.message)}</p>
          )}
        </div>

        {podeCadastrarCliente && (
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-kx-legenda">Não encontrou?</span>
            <Button
              type="button"
              variant="outline"
              className="h-[34px] rounded-kx-botao border-kx-campo-borda px-4 text-xs"
              onClick={() => setModalClienteAberto(true)}
            >
              Cadastrar novo cliente
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3.5 rounded-kx-cartao bg-kx-superficie p-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-kx-texto">Aparelho</span>
          <div className="ml-auto flex gap-1.5">
            {TIPOS_APARELHO.map((tipo) => {
              const ativo = tipoAparelho === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setTipoAparelho(ativo ? null : tipo)}
                  className={
                    ativo
                      ? "h-8 rounded-kx-pilula border border-kx-primaria bg-kx-primaria px-3 text-xs font-bold text-primary-foreground"
                      : "h-8 rounded-kx-pilula border border-kx-campo-borda bg-transparent px-3 text-xs font-bold text-kx-texto-2"
                  }
                >
                  {tipo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marca" className="text-[13px] font-bold text-kx-texto">
              Marca
            </Label>
            <Input id="marca" placeholder="Ex.: Samsung, Apple, Motorola" className={CAMPO} {...register("marca")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modelo" className="text-[13px] font-bold text-kx-texto">
              Modelo
            </Label>
            <Input id="modelo" placeholder="Ex.: Galaxy A54" className={CAMPO} {...register("modelo")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="imei" className="text-[13px] font-bold text-kx-texto">
              IMEI / Nº de série
            </Label>
            {/* `autoComplete="off"` e `inputMode` não são detalhe: o Chrome enfia
                e-mail salvo num campo de texto solto perto de nome e telefone,
                e há OS em produção com e-mail gravado no IMEI por causa disso.
                A validação de formato já recusa isso ao salvar — mas recusar
                depois de digitar é pior que não ser preenchido errado. */}
            <Input
              id="imei"
              placeholder="Só números"
              className={CAMPO}
              autoComplete="off"
              inputMode="numeric"
              {...register("imei")}
            />
            {errors.imei ? (
              <span className="text-[11px] text-kx-erro-texto">{String(errors.imei.message)}</span>
            ) : (
              <span className="text-[11px] text-kx-legenda">O sistema valida o formato antes de salvar.</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha" className="text-[13px] font-bold text-kx-texto">
              Senha do aparelho
            </Label>
            <Input id="senha" placeholder="Opcional" className={CAMPO} {...register("senha")} />
            <span className="text-[11px] text-kx-legenda">Guardada de forma protegida; quem vê fica registrado.</span>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-kx-botao bg-kx-cartao p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-kx-texto">Senha de desenho</span>
            <span className="text-[11px] text-kx-legenda">Toque nos pontos na ordem do cliente</span>
          </div>
          <input type="hidden" {...register("senhaDesenho")} />
          <div className="ml-auto grid grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }, (_, indice) => indice + 1).map((ponto) => {
              const ordem = padraoDesenho.indexOf(ponto) + 1;
              const ativo = ordem > 0;
              return (
                <button
                  key={ponto}
                  type="button"
                  onClick={() => alternarPontoDesenho(ponto)}
                  aria-label={`Ponto ${ponto}`}
                  className={`relative h-5 w-5 rounded-full border-2 ${
                    ativo ? "border-kx-destaque bg-kx-destaque/25" : "border-kx-campo-borda bg-transparent"
                  }`}
                >
                  {ativo && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-kx-primaria text-[8px] font-bold text-primary-foreground">
                      {ordem}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-[34px] shrink-0 rounded-kx-botao border-kx-campo-borda px-4 text-xs"
            onClick={limparDesenho}
          >
            Limpar
          </Button>
        </div>
      </div>

      <ModalNovoCliente
        aberto={modalClienteAberto}
        aoFechar={() => setModalClienteAberto(false)}
        aoSalvar={handleSalvarNovoCliente}
      />
    </div>
  );
}
