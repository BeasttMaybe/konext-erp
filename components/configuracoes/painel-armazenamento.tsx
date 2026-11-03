"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CloudUpload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  obterSituacaoArmazenamento,
  testarArmazenamento,
  type SituacaoArmazenamento,
} from "@/app/actions/armazenamento-fotos";
import type { ResultadoDiagnostico } from "@/lib/fotos/armazenamento";
import { Button } from "@/components/ui/button";

/**
 * Armazenamento de fotos — situação e diagnóstico.
 *
 * Este painel existe por uma razão específica: o projeto não tem ambiente de
 * Preview, então a primeira vez que o código fala com o R2 é em produção.
 * Descobrir ali que a credencial está errada, no meio do atendimento de um
 * cliente e com a foto do aparelho dele na mão, é o pior momento possível.
 * Aqui o teste roda num arquivo de três linhas que sai do bucket em seguida.
 *
 * O painel mostra bucket e Account ID, que não são segredo, e NUNCA as chaves —
 * elas não saem do servidor, e nem o dono consegue lê-las de volta no Vercel,
 * porque entraram como Secret.
 */
export function PainelArmazenamento() {
  const [situacao, setSituacao] = useState<SituacaoArmazenamento | null>(null);
  const [resultado, setResultado] = useState<ResultadoDiagnostico | null>(null);
  const [emAndamento, iniciarTransicao] = useTransition();

  useEffect(() => {
    let ativo = true;

    void obterSituacaoArmazenamento()
      .then((dados) => {
        if (ativo) setSituacao(dados);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível ler a situação do armazenamento.");
      });

    return () => {
      ativo = false;
    };
  }, []);

  const testar = () => {
    iniciarTransicao(async () => {
      try {
        const dados = await testarArmazenamento();
        setResultado(dados);

        if (dados.erro === null) toast.success("Armazenamento funcionando.");
        else toast.error("O teste falhou. Veja o detalhe abaixo.");
      } catch {
        toast.error("Não foi possível rodar o teste.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <div className="flex items-center gap-2">
          <CloudUpload className="h-4 w-4 text-kx-legenda" aria-hidden />
          <h3 className="text-base font-semibold text-kx-texto">Onde as fotos ficam guardadas</h3>
        </div>

        <p className="mt-2 text-sm text-kx-legenda">
          As fotos dos aparelhos não ficam no banco de dados — ficam num bucket do Cloudflare R2,
          e o sistema guarda só o caminho de cada arquivo. As chaves de acesso vivem nas variáveis
          de ambiente do Vercel e não passam por esta tela.
        </p>

        {situacao === null ? (
          <div className="mt-4 h-20 animate-pulse rounded-kx-botao bg-kx-superficie" />
        ) : situacao.configurado ? (
          <dl className="mt-4 space-y-2">
            <Linha rotulo="Bucket" valor={situacao.bucket ?? "—"} />
            <Linha rotulo="Conta Cloudflare" valor={situacao.accountId ?? "—"} />
            <Linha rotulo="Chaves de acesso" valor="Configuradas (não exibidas)" />
          </dl>
        ) : (
          <div className="mt-4 rounded-kx-botao border border-kx-alerta bg-kx-alerta-fundo p-4">
            <p className="text-sm font-bold text-kx-alerta-texto">
              Armazenamento não configurado
            </p>
            <p className="mt-1 text-sm text-kx-texto-2">
              {situacao.faltando.length === 4
                ? "Nenhuma das quatro variáveis está definida."
                : "Faltam variáveis de ambiente no Vercel:"}
            </p>
            {situacao.faltando.length < 4 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {situacao.faltando.map((nome) => (
                  <li
                    key={nome}
                    className="rounded-kx-pilula bg-kx-painel px-2.5 py-1 text-xs font-bold tabular-nums text-kx-alerta-texto"
                  >
                    {nome}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-kx-legenda">
              Enquanto faltar, o envio de fotos na OS fica desligado. O resto do sistema não é
              afetado.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
        <h3 className="text-base font-semibold text-kx-texto">Testar a conexão</h3>
        <p className="mt-2 text-sm text-kx-legenda">
          Grava um arquivo de teste de três linhas, lê de volta para conferir que é o mesmo
          conteúdo, e apaga. Nenhuma foto é envolvida, e nada fica no bucket depois.
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={emAndamento || situacao?.configurado === false}
          onClick={testar}
        >
          {emAndamento && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {emAndamento ? "Testando..." : "Testar agora"}
        </Button>

        {resultado !== null && (
          <div className="mt-4 space-y-3">
            {/* As três etapas aparecem separadas porque falham por motivos
                diferentes: um token só de escrita grava e não lê, e um sem
                permissão de apagar deixa lixo no bucket. */}
            <ul className="space-y-1.5">
              <Etapa rotulo="Gravar o arquivo" passou={resultado.gravou} />
              <Etapa rotulo="Ler de volta e conferir o conteúdo" passou={resultado.leu} />
              <Etapa rotulo="Apagar o arquivo de teste" passou={resultado.apagou} />
            </ul>

            {resultado.erro === null ? (
              <div className="rounded-kx-botao border border-kx-sucesso bg-kx-sucesso-fundo p-4">
                <p className="text-sm font-bold text-kx-sucesso-texto">
                  As três etapas passaram.
                </p>
                <p className="mt-1 text-sm text-kx-texto-2">
                  O armazenamento está pronto para receber as fotos das OS.
                </p>
              </div>
            ) : (
              <div className="rounded-kx-botao border border-kx-erro-borda bg-kx-erro-fundo p-4">
                <p className="text-sm font-bold text-kx-erro-texto">
                  {resultado.etapaQueFalhou === "CONFIGURACAO"
                    ? "Falta configuração"
                    : `Falhou ao ${rotuloDaEtapa(resultado.etapaQueFalhou)}`}
                </p>
                <p className="mt-1 text-sm text-kx-texto-2">{resultado.erro}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function rotuloDaEtapa(etapa: ResultadoDiagnostico["etapaQueFalhou"]): string {
  if (etapa === "GRAVAR") return "gravar";
  if (etapa === "LER") return "ler de volta";
  if (etapa === "APAGAR") return "apagar o arquivo de teste";
  return "verificar";
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-kx-painel-borda pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-kx-legenda">{rotulo}</dt>
      <dd className="text-sm font-semibold tabular-nums text-kx-texto">{valor}</dd>
    </div>
  );
}

function Etapa({ rotulo, passou }: { rotulo: string; passou: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {passou ? (
        <Check className="h-4 w-4 shrink-0 text-kx-sucesso-icone" aria-hidden />
      ) : (
        <X className="h-4 w-4 shrink-0 text-kx-erro-icone" aria-hidden />
      )}
      <span className={passou ? "text-kx-texto-2" : "font-semibold text-kx-texto"}>{rotulo}</span>
    </li>
  );
}
