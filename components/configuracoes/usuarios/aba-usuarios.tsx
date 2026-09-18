"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listarUsuariosDaEmpresa, type UsuarioListado } from "@/app/actions/usuarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModalEditarUsuario } from "./modal-editar-usuario";
import { ModalTransferirPropriedade } from "./modal-transferir-propriedade";

function formatarUltimoAcesso(iso: string | null): string {
  if (!iso) return "Nunca acessou";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function buscarUsuarios(
  aoConcluir: (usuarios: UsuarioListado[]) => void,
  aoFinalizar: () => void
) {
  listarUsuariosDaEmpresa()
    .then((resultado) => {
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        aoConcluir([]);
        return;
      }
      aoConcluir(resultado.dados);
    })
    .finally(aoFinalizar);
}

export function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioListado[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioListado | null>(null);
  const [transferenciaAberta, setTransferenciaAberta] = useState(false);

  const recarregar = () => {
    setCarregando(true);
    buscarUsuarios(setUsuarios, () => setCarregando(false));
  };

  useEffect(() => {
    buscarUsuarios(setUsuarios, () => setCarregando(false));
  }, []);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando usuários...
                </TableCell>
              </TableRow>
            ) : !usuarios || usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((usuario) => (
                <TableRow key={usuario.usuarioEmpresaId}>
                  <TableCell className="font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {usuario.nome}
                      {usuario.souEu && <span className="text-xs text-muted-foreground">(você)</span>}
                      {usuario.ehProprietario && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Responsável pela loja
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{usuario.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{usuario.cargoNome}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatarUltimoAcesso(usuario.ultimoAcessoEm)}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        usuario.ativo
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }
                    >
                      {usuario.ativo ? "Ativo" : "Desativado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {usuario.ehProprietario ? (
                      usuario.souEu && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setTransferenciaAberta(true)}>
                          Transferir titularidade
                        </Button>
                      )
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={() => setUsuarioEmEdicao(usuario)}>
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {usuarioEmEdicao && (
        <ModalEditarUsuario
          usuario={usuarioEmEdicao}
          aberto
          onFechar={() => setUsuarioEmEdicao(null)}
          onSalvo={() => {
            setUsuarioEmEdicao(null);
            recarregar();
          }}
        />
      )}

      {transferenciaAberta && usuarios && (
        <ModalTransferirPropriedade
          usuarios={usuarios}
          proprietarioAtualId={usuarios.find((usuario) => usuario.ehProprietario)?.usuarioEmpresaId ?? ""}
          aberto
          onFechar={() => setTransferenciaAberta(false)}
          onTransferido={() => {
            setTransferenciaAberta(false);
            recarregar();
          }}
        />
      )}
    </div>
  );
}
