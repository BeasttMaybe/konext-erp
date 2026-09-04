"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  consultarCnpjReceita,
  salvarConfiguracoes,
  type DadosConfiguracoes,
} from "@/app/actions/configuracoes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatarCepVisual,
  formatarCnpjVisual,
  formatarTelefoneVisual,
} from "@/lib/configuracoes-documentos";
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

  const valoresIniciais: DadosConfiguracoes = {
    ...defaultValues,
    cnpj: formatarCnpjVisual(defaultValues.cnpj),
    telefone: formatarTelefoneVisual(defaultValues.telefone),
    cep: formatarCepVisual(defaultValues.cep),
  };

  const { register, control, handleSubmit, getValues, setValue, reset, formState } = useForm<DadosConfiguracoes>({
    defaultValues: valoresIniciais,
  });

  const valoresMonitorados = useWatch({ control });
  const configuracaoAtual: DadosConfiguracoes = {
    ...valoresIniciais,
    ...valoresMonitorados,
  };

  const secaoComPersistenciaAtiva =
    secaoAtiva === "empresa" ||
    secaoAtiva === "documentos" ||
    secaoAtiva === "os" ||
    secaoAtiva === "garantias" ||
    secaoAtiva === "pdv-vendas";

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

      const {
        razaoSocial,
        nomeFantasia,
        cnpj,
        inscricaoEstadual,
        telefone,
        cep,
        logradouro,
        numero,
        bairro,
        cidade,
        estado,
      } = resultado.dados;
      setValue("razaoSocial", razaoSocial, { shouldDirty: true });
      setValue("nomeFantasia", nomeFantasia, { shouldDirty: true });
      setValue("cnpj", formatarCnpjVisual(cnpj), { shouldDirty: true });
      setValue("inscricaoEstadual", inscricaoEstadual, { shouldDirty: true });
      setValue("telefone", formatarTelefoneVisual(telefone), { shouldDirty: true });
      setValue("cep", formatarCepVisual(cep), { shouldDirty: true });
      setValue("logradouro", logradouro, { shouldDirty: true });
      setValue("numero", numero, { shouldDirty: true });
      setValue("bairro", bairro, { shouldDirty: true });
      setValue("cidade", cidade, { shouldDirty: true });
      setValue("estado", estado, { shouldDirty: true });
      setValue(
        "endereco",
        montarEnderecoCompleto({
          logradouro,
          numero,
          bairro,
          cidade,
          estado,
          cep: formatarCepVisual(cep),
        }),
        { shouldDirty: true }
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
        ...valoresIniciais,
        ...dados,
      };
      await salvarConfiguracoes(dadosConsolidados);
      reset(dadosConsolidados);
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
            configuracaoAtual={configuracaoAtual}
          />
        );
      case "documentos":
        return (
          <PainelDocumentos
            register={register}
            control={control}
            configuracaoAtual={configuracaoAtual}
            salvando={salvando}
          />
        );
      case "os":
        return (
          <PainelOs
            register={register}
            control={control}
            salvando={salvando}
            configuracaoAtual={configuracaoAtual}
          />
        );
      case "garantias":
        return (
          <PainelGarantias
            register={register}
            control={control}
            salvando={salvando}
            configuracaoAtual={configuracaoAtual}
          />
        );
      case "pdv-vendas":
        return (
          <PainelPdv
            register={register}
            control={control}
            salvando={salvando}
            configuracaoAtual={configuracaoAtual}
          />
        );
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
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="text-xs text-muted-foreground">
            {secaoComPersistenciaAtiva
              ? formState.isDirty
                ? "Há alterações pendentes nesta etapa."
                : "Nenhuma alteração pendente no formulário atual."
              : "Nesta etapa não há persistência ativa."}
          </p>
          <Button
            type="submit"
            disabled={salvando || !secaoComPersistenciaAtiva}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {salvando
              ? "Salvando..."
              : secaoAtiva === "documentos"
                ? "Salvar documentos"
                : secaoAtiva === "os"
                  ? "Salvar regras de OS"
                  : secaoAtiva === "garantias"
                    ? "Salvar regras de garantia"
                    : secaoAtiva === "pdv-vendas"
                      ? "Salvar regras de PDV"
                    : "Salvar empresa"}
          </Button>
        </div>
      </div>
    </form>
  );
}
