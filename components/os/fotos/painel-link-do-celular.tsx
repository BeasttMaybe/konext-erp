"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2Off, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";

import {
  criarLinkDeFotos,
  listarLinksDaOS,
  revogarLinkDeFotos,
  type LinkDeFoto,
  type LinkRecemCriado,
} from "@/app/actions/link-foto-os";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PilulaStatus } from "@/components/ui/pilula-status";
import { HORAS_DE_VALIDADE_DO_LINK } from "@/lib/dominio/os/fotos";
import { PALETA_PAPEL } from "@/lib/design/papel";

/**
 * O link de envio pelo celular, do lado do balcão.
 *
 * O QR code é o caminho principal e o endereço escrito é o plano B. O segredo
 * tem 43 caracteres de base64url — maiúscula, minúscula, hífen e sublinhado
 * misturados — e ninguém digita isso num celular sem errar. Apontar a câmera
 * é o gesto que a pessoa já faz.
 *
 * O link aparece UMA vez. Depois que esta janela fecha, o sistema não
 * consegue mostrá-lo de novo: o banco guarda só o hash. Fechou sem copiar,
 * gera outro — que é o mesmo contrato de uma senha, e é dito na tela pra
 * ninguém procurar onde não tem.
 */
export function PainelLinkDoCelular({
  ordemServicoId,
  aberto,
  aoFechar,
}: {
  ordemServicoId: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const [links, setLinks] = useState<LinkDeFoto[]>([]);
  const [recem, setRecem] = useState<LinkRecemCriado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [criando, iniciarCriacao] = useTransition();
  const [revogando, iniciarRevogacao] = useTransition();

  const carregar = useCallback(async () => {
    setLinks(await listarLinksDaOS(ordemServicoId));
  }, [ordemServicoId]);

  useEffect(() => {
    if (!aberto) return;

    let ativo = true;

    void (async () => {
      const lista = await listarLinksDaOS(ordemServicoId);
      if (ativo) setLinks(lista);
    })();

    return () => {
      ativo = false;
    };
  }, [aberto, ordemServicoId]);

  function gerar() {
    iniciarCriacao(async () => {
      const resultado = await criarLinkDeFotos(ordemServicoId);

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      setRecem(resultado.link);
      setCopiado(false);
      await carregar();
    });
  }

  function revogar(tokenId: string) {
    iniciarRevogacao(async () => {
      const resultado = await revogarLinkDeFotos(tokenId);

      if (!resultado.sucesso) {
        toast.error(resultado.erro ?? "Não consegui revogar.");
        return;
      }

      // Se o link revogado for o que está na tela, ele some: deixar o QR code
      // visível depois de revogar é convidar alguém a escanear o que já morreu.
      setRecem(null);
      toast.success("Link revogado. Ele não abre mais.");
      await carregar();
    });
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o endereço e copie à mão.");
    }
  }

  const vivos = links.filter((link) => link.situacao === "VALIDO");

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-kx-texto-2" aria-hidden />
            <DialogTitle>Enviar fotos pelo celular</DialogTitle>
          </div>
          <DialogDescription>
            Gere um link, aponte a câmera do celular pro QR code e tire as fotos por lá. Elas
            aparecem nesta OS sozinhas.
          </DialogDescription>
        </DialogHeader>

        {recem ? (
          <div className="space-y-3">
            {recem.qrCodeSvg && (
              <div
                // Branco de verdade, do mesmo lugar de onde a impressão tira
                // o dela: um QR code precisa de contraste máximo pra ser
                // lido, e no tema escuro o fundo do cartão deixaria o código
                // preto sobre cinza — que é onde a câmera do celular desiste.
                style={{ backgroundColor: PALETA_PAPEL.papel }}
                className="mx-auto w-48 rounded-kx-cartao p-3 [&>svg]:h-auto [&>svg]:w-full"
                // O SVG vem do gerador de QR no servidor, a partir de uma URL
                // que o próprio servidor montou — não há texto de usuário no
                // meio. É a mesma origem do código de barras da etiqueta.
                dangerouslySetInnerHTML={{ __html: recem.qrCodeSvg }}
              />
            )}

            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-kx-botao bg-muted px-3 py-2 text-xs text-kx-texto-2">
                {recem.url}
              </code>

              <Button type="button" variant="outline" size="sm" onClick={() => void copiar(recem.url)}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>

            <Aviso variante="alerta">
              Este endereço aparece só agora. Se fechar esta janela sem copiar, não dá pra vê-lo
              de novo — é só gerar outro. Vale por {HORAS_DE_VALIDADE_DO_LINK} horas.
            </Aviso>
          </div>
        ) : (
          <Button type="button" onClick={gerar} disabled={criando} className="w-full">
            <QrCode className="h-4 w-4" />
            {criando ? "Gerando..." : "Gerar link e QR code"}
          </Button>
        )}

        {links.length > 0 && (
          <div className="space-y-2 border-t border-kx-painel-borda pt-3">
            <p className="text-xs font-medium text-kx-texto-2">
              {vivos.length === 0
                ? "Nenhum link aberto nesta OS."
                : vivos.length === 1
                  ? "1 link aberto."
                  : `${vivos.length} links abertos.`}
            </p>

            <ul className="space-y-1.5">
              {links.slice(0, 5).map((link) => (
                <li key={link.id} className="flex items-center gap-2 text-xs">
                  <PilulaStatus
                    variante={
                      link.situacao === "VALIDO"
                        ? "sucesso"
                        : link.situacao === "REVOGADO"
                          ? "erro"
                          : "neutro"
                    }
                  >
                    {link.situacao === "VALIDO"
                      ? "aberto"
                      : link.situacao === "REVOGADO"
                        ? "revogado"
                        : "expirou"}
                  </PilulaStatus>

                  <span className="min-w-0 flex-1 truncate text-kx-legenda">
                    {new Date(link.criadoEm).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {link.criadoPorNome && ` · ${link.criadoPorNome}`}
                    {link.ultimoUsoEm ? " · já foi aberto" : " · ainda não foi aberto"}
                  </span>

                  {link.situacao === "VALIDO" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={revogando}
                      onClick={() => revogar(link.id)}
                      title="Revogar este link"
                    >
                      <Link2Off className="h-3.5 w-3.5" />
                      Revogar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
