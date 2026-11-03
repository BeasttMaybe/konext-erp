"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  consultarCnpjReceita,
  salvarConfiguracoes,
  type DadosConfiguracoes,
} from "@/app/actions/configuracoes";
import { useTemPermissao } from "@/contextos/contexto-permissoes";
import { Button } from "@/components/ui/button";
import {
  formatarCepVisual,
  formatarCnpjVisual,
  formatarTelefoneVisual,
} from "@/lib/configuracoes-documentos";
import { MenuConfiguracoes } from "./menu-configuracoes";
import { PainelDocumentos } from "./painel-documentos";
import { PainelEmpresa } from "./painel-empresa";
import { PainelGarantias } from "./painel-garantias";
import { PainelArmazenamento } from "./painel-armazenamento";
import { PainelMarcasPeca } from "./painel-marcas-peca";
import type { MarcaPecaListada } from "@/app/actions/marcas-peca";
import { PainelOs } from "./painel-os";
import { PainelPdv } from "./painel-pdv";
import { SecaoUsuariosCargos } from "./usuarios/secao-usuarios-cargos";
import { SECOES_CONFIGURACOES, type SecaoConfiguracoesId } from "./tipos";

type PropsLayoutConfiguracoes = {
  defaultValues: DadosConfiguracoes;
  /** `null` quando o usuario nao tem configuracoes.sistema — a secao some. */
  marcasPeca: MarcaPecaListada[] | null;
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

export function LayoutConfiguracoes({ defaultValues, marcasPeca }: PropsLayoutConfiguracoes) {
  const podeVerUsuariosCargos = useTemPermissao("configuracoes.usuarios");
  const secoesVisiveis = useMemo(
    () =>
      SECOES_CONFIGURACOES.filter((secao) => {
        if (secao.id === "usuarios") return podeVerUsuariosCargos;
        if (secao.id === "marcas-peca") return marcasPeca !== null;
        // Armazenamento usa a mesma permissao de marcas de peca
        // (configuracoes.sistema); `marcasPeca !== null` ja e esse sinal, e a
        // propria action recusa quem nao tem.
        if (secao.id === "armazenamento") return marcasPeca !== null;
        return true;
      }),
    [podeVerUsuariosCargos, marcasPeca]
  );

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
    secaoAtiva === "pdv-caixa";

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
            setValue={setValue}
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
      case "pdv-caixa":
        return (
          <PainelPdv
            register={register}
            control={control}
            salvando={salvando}
            configuracaoAtual={configuracaoAtual}
          />
        );
      case "marcas-peca":
        // Cadastro proprio, com as suas acoes: nao participa do formulario de
        // Configuracoes nem da barra de salvar (ver secaoComPersistenciaAtiva).
        return marcasPeca ? <PainelMarcasPeca marcas={marcasPeca} /> : null;
      case "armazenamento":
        // Cadastro/diagnostico proprio: nao participa do formulario de
        // Configuracoes nem da barra de salvar.
        return marcasPeca !== null ? <PainelArmazenamento /> : null;
      case "usuarios":
        return podeVerUsuariosCargos ? <SecaoUsuariosCargos /> : null;
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit(aoSalvar)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-kx-legenda">Configurações</span>
        <span className="text-[22px] font-extrabold tracking-tight text-kx-texto">
          {secoesVisiveis.find((secao) => secao.id === secaoAtiva)?.rotulo}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1400px]:grid-cols-[268px_1fr] min-[1400px]:items-start">
        <div className="min-[1400px]:sticky min-[1400px]:top-4">
          <MenuConfiguracoes
            secoes={secoesVisiveis}
            secaoAtiva={secaoAtiva}
            onSelecionarSecao={setSecaoAtiva}
          />
        </div>

        <div className="flex flex-col gap-4">
          {renderizarPainelAtivo()}
        </div>
      </div>

      {secaoComPersistenciaAtiva && (
        <div className="sticky bottom-0 z-kx-sticky flex justify-end bg-kx-fundo pt-2 pb-2">
          <div className="flex items-center gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-painel px-4 py-2.5 shadow-kx-cartao">
            <p className="text-xs text-kx-legenda">
              {formState.isDirty
                ? "Há alterações pendentes nesta etapa."
                : "Nenhuma alteração pendente no formulário atual."}
            </p>
            <Button type="submit" disabled={salvando} className="rounded-kx-botao">
              {salvando
                ? "Salvando..."
                : secaoAtiva === "documentos"
                  ? "Salvar documentos"
                  : secaoAtiva === "os"
                    ? "Salvar regras de OS"
                    : secaoAtiva === "garantias"
                      ? "Salvar regras de garantia"
                      : secaoAtiva === "pdv-caixa"
                        ? "Salvar regras de PDV"
                        : "Salvar empresa"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
