"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { enviarLogoDaEmpresa, removerLogoDaEmpresa } from "@/app/actions/logo-empresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  conferirArquivoEscolhido,
  ehCaminhoDaLogoEnviada,
  formatarMegabytes,
  TAMANHO_MAXIMO_DO_ARQUIVO_ESCOLHIDO,
} from "@/lib/dominio/empresa/logo-enviada";
import { prepararLogo } from "@/lib/fotos/reduzir-logo";

/**
 * Bloco da logo na tela Empresa: enviar arquivo (o caminho principal) ou
 * colar um link (o de antes, para quem ja tem a logo num site).
 *
 * O envio GRAVA na hora — nao espera o "Salvar" do rodape. Depois disso o
 * campo do formulario e atualizado para o mesmo endereco, para o "Salvar"
 * do rodape nao gravar por cima o endereco antigo que ainda estava nele.
 */
export function EnvioDaLogo({
  logoUrl,
  nomeFantasia,
  aoMudarLogo,
  campoDoLink,
}: {
  logoUrl: string;
  nomeFantasia: string;
  /** Atualiza o campo `logoUrl` do formulario. `gravado` = ja esta no banco. */
  aoMudarLogo: (url: string, gravado: boolean) => void;
  campoDoLink: React.ComponentProps<"input">;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [mostrarLink, setMostrarLink] = useState(Boolean(logoUrl) && !ehCaminhoDaLogoEnviada(logoUrl));
  const [falhaPrevia, setFalhaPrevia] = useState<string | null>(null);

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const problema = conferirArquivoEscolhido(arquivo);
    if (problema) {
      toast.error(problema);
      return;
    }
    setEnviando(true);
    try {
      const pronto = await prepararLogo(arquivo);
      const dados = new FormData();
      dados.set("arquivo", pronto);
      const resultado = await enviarLogoDaEmpresa(dados);
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      aoMudarLogo(resultado.logoUrl, true);
      setMostrarLink(false);
      // A barra lateral le a logo no servidor: atualiza sem recarregar a pagina.
      router.refresh();
      toast.success("Logo atualizada.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar a logo.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const remover = async () => {
    if (!ehCaminhoDaLogoEnviada(logoUrl)) {
      aoMudarLogo("", false);
      return;
    }
    setEnviando(true);
    try {
      const resultado = await removerLogoDaEmpresa();
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      aoMudarLogo("", true);
      router.refresh();
      toast.success("Logo removida.");
    } finally {
      setEnviando(false);
    }
  };

  const previaQuebrada = Boolean(logoUrl) && falhaPrevia === logoUrl;

  return (
    <div className="flex flex-col gap-3 rounded-kx-botao bg-kx-superficie p-4 sm:flex-row sm:items-center">
      <div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-kx-botao border border-kx-painel-borda bg-kx-papel text-lg font-extrabold text-kx-papel-texto">
        {logoUrl && !previaQuebrada ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo da propria loja (enviada ou link externo).
          <img src={logoUrl} alt="Logo da empresa" className="h-full w-full object-contain p-1.5" onError={() => setFalhaPrevia(logoUrl)} />
        ) : (
          (nomeFantasia || "K").charAt(0).toUpperCase()
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="text-sm font-bold text-kx-texto">Logo da loja</p>
          <p className="text-xs text-kx-legenda">
            PNG, JPG ou WEBP, até {formatarMegabytes(TAMANHO_MAXIMO_DO_ARQUIVO_ESCOLHIDO)}. Logo horizontal com fundo
            transparente fica melhor. Aparece no sistema e em todos os documentos.
          </p>
          {previaQuebrada ? (
            <p role="alert" className="mt-1 text-xs font-medium text-kx-erro-texto">
              Esta imagem não abre. Envie o arquivo da logo.
            </p>
          ) : null}
        </div>

        <input
          ref={entrada}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(evento) => void escolher(evento.target.files?.[0])}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-10 rounded-kx-botao" disabled={enviando} onClick={() => entrada.current?.click()}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" />}
            {enviando ? "Enviando..." : logoUrl ? "Trocar logo" : "Enviar logo"}
          </Button>
          {logoUrl ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-kx-botao border-kx-erro-borda text-kx-erro-texto hover:bg-kx-erro-fundo"
              disabled={enviando}
              onClick={() => void remover()}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          ) : null}
          {!mostrarLink ? (
            <Button type="button" variant="ghost" className="h-10 rounded-kx-botao" onClick={() => setMostrarLink(true)}>
              <Link2 className="h-4 w-4" />
              Usar um link
            </Button>
          ) : null}
        </div>

        {mostrarLink ? (
          <Input
            placeholder="https://exemplo.com/logo.png"
            aria-label="Link da logo"
            className="h-10 border-kx-campo-borda bg-kx-painel"
            {...campoDoLink}
          />
        ) : null}
      </div>
    </div>
  );
}
