"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  consultarCnpjReceita,
  salvarConfiguracoes,
  type DadosConfiguracoes,
} from "@/app/actions/configuracoes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MenuConfiguracoes } from "./menu-configuracoes";
import { PainelAparencia } from "./painel-aparencia";
import { PainelAuditoria } from "./painel-auditoria";
import { PainelCrm } from "./painel-crm";
import { PainelDocumentos } from "./painel-documentos";
import { PainelEmpresa } from "./painel-empresa";
import { PainelEstoque } from "./painel-estoque";
import { PainelFinanceiro } from "./painel-financeiro";
import { PainelGarantias } from "./painel-garantias";
import { PainelMetas } from "./painel-metas";
import { PainelOs } from "./painel-os";
import { PainelPdv } from "./painel-pdv";
import { PainelUsuarios } from "./painel-usuarios";
import { SECOES_CONFIGURACOES, type SecaoConfiguracoesId } from "./tipos";

type PropsLayoutConfiguracoes = {
  defaultValues: DadosConfiguracoes;
};

function montarEnderecoCompleto(dados: {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}) {
  const parteRua = [dados.logradouro, dados.numero].filter(Boolean).join(", ");
  const parteLocal = [dados.bairro, dados.cidade, dados.estado].filter(Boolean).join(" - ");
  const parteCep = dados.cep ? `CEP ${dados.cep}` : "";
  return [parteRua, parteLocal, parteCep].filter(Boolean).join(" | ");
}

export function LayoutConfiguracoes({ defaultValues }: PropsLayoutConfiguracoes) {
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoConfiguracoesId>("empresa");
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const { register, handleSubmit, getValues, setValue } = useForm<DadosConfiguracoes>({
    defaultValues,
  });

  const descricaoSecaoAtiva = useMemo(() => {
    return SECOES_CONFIGURACOES.find((secao) => secao.id === secaoAtiva)?.descricao ?? "";
  }, [secaoAtiva]);

  const aoBuscarDadosCnpj = async () => {
    try {
      setBuscandoCnpj(true);
      const resultado = await consultarCnpjReceita(getValues("cnpj"));

      if (!resultado.sucesso) {
        toast.error("CNPJ inválido ou não encontrado na Receita.");
        return;
      }

      const { razaoSocial, cep, logradouro, numero, bairro, cidade, estado } = resultado.dados;
      setValue("razaoSocial", razaoSocial);
      setValue("cep", cep);
      setValue("logradouro", logradouro);
      setValue("numero", numero);
      setValue("bairro", bairro);
      setValue("cidade", cidade);
      setValue("estado", estado);
      setValue(
        "endereco",
        montarEnderecoCompleto({
          logradouro,
          numero,
          bairro,
          cidade,
          estado,
          cep,
        })
      );

      toast.success("Dados da empresa carregados com sucesso.");
    } catch {
      toast.error("CNPJ inválido ou não encontrado na Receita.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const aoSalvar = async (dados: DadosConfiguracoes) => {
    try {
      setSalvando(true);
      const dadosConsolidados: DadosConfiguracoes = {
        ...defaultValues,
        ...dados,
      };
      await salvarConfiguracoes(dadosConsolidados);
      toast.success("Configurações salvas com sucesso.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível salvar as configurações.";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const renderizarPainelAtivo = () => {
    switch (secaoAtiva) {
      case "empresa":
        return (
          <PainelEmpresa
            register={register}
            buscandoCnpj={buscandoCnpj}
            onBuscarCnpj={aoBuscarDadosCnpj}
            salvando={salvando}
          />
        );
      case "documentos":
        return <PainelDocumentos />;
      case "os":
        return <PainelOs />;
      case "garantias":
        return <PainelGarantias />;
      case "pdv-vendas":
        return <PainelPdv />;
      case "financeiro":
        return <PainelFinanceiro />;
      case "estoque":
        return <PainelEstoque />;
      case "crm":
        return <PainelCrm />;
      case "metas":
        return <PainelMetas />;
      case "usuarios":
        return <PainelUsuarios />;
      case "auditoria":
        return <PainelAuditoria />;
      case "aparencia":
        return <PainelAparencia />;
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit(aoSalvar)} className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <MenuConfiguracoes
          secoes={SECOES_CONFIGURACOES}
          secaoAtiva={secaoAtiva}
          onSelecionarSecao={setSecaoAtiva}
        />

        <div className="space-y-4">
          <Card className="border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Seção ativa</p>
            <p className="text-base font-semibold text-foreground">
              {SECOES_CONFIGURACOES.find((secao) => secao.id === secaoAtiva)?.rotulo}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{descricaoSecaoAtiva}</p>
          </Card>

          {renderizarPainelAtivo()}
        </div>
      </div>

      <div className="sticky bottom-3 flex justify-end">
        <Button
          type="submit"
          disabled={salvando || secaoAtiva !== "empresa"}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
