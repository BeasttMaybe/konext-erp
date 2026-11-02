"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
 Copy,
 Eye,
 FilePlus,
 Mail,
 MessageCircle,
 MoreHorizontal,
 Printer,
 ShoppingCart,
 Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProposalActionsCellProps = {
 proposalId: string;
 permitirIntegracoesLegadas?: boolean;
};

export function ProposalActionsCell({
 proposalId,
 permitirIntegracoesLegadas = true,
}: ProposalActionsCellProps) {
 const router = useRouter();

 return (
 <div className="flex items-center justify-end gap-1.5">
 <Button
 asChild
 type="button"
 variant="ghost"
 size="icon-sm"
 aria-label="Visualizar proposta"
 className="text-kx-texto-2 hover:bg-kx-painel/5 hover:text-kx-texto"
 >
 <Link href={`/crm/propostas/${proposalId}`}>
 <Eye className="h-4 w-4" />
 </Link>
 </Button>

 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 type="button"
 variant="ghost"
 size="icon-sm"
 aria-label="Mais acoes"
 className="text-kx-texto-2 hover:bg-kx-painel/5 hover:text-kx-texto"
 >
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56 border-kx-painel/10 bg-kx-superficie/95 text-kx-texto">
 {permitirIntegracoesLegadas && (
 <>
 <DropdownMenuItem
 className="cursor-pointer gap-2"
 onSelect={() => router.push(`/vendas/pedidos/novo?propostaId=${proposalId}`)}
 >
 <ShoppingCart className="h-4 w-4 text-kx-sucesso-texto" />
 Gerar venda
 </DropdownMenuItem>
 <DropdownMenuItem
 className="cursor-pointer gap-2"
 onSelect={() => router.push(`/os/nova?propostaId=${proposalId}`)}
 >
 <Wrench className="h-4 w-4 text-kx-sucesso-texto" />
 Gerar ordem de servico
 </DropdownMenuItem>

 <DropdownMenuSeparator className="bg-kx-painel/10" />
 </>
 )}

 <DropdownMenuItem
 className="cursor-pointer gap-2"
 onSelect={() => router.push(`/propostas/${proposalId}/imprimir`)}
 >
 <Printer className="h-4 w-4" />
 Imprimir
 </DropdownMenuItem>
 <DropdownMenuItem className="cursor-pointer gap-2">
 <Mail className="h-4 w-4" />
 Enviar por e-mail
 </DropdownMenuItem>
 <DropdownMenuItem className="cursor-pointer gap-2">
 <MessageCircle className="h-4 w-4" />
 Enviar por whatsapp
 </DropdownMenuItem>

 <DropdownMenuSeparator className="bg-kx-painel/10" />

 <DropdownMenuItem className="cursor-pointer gap-2">
 <Copy className="h-4 w-4" />
 Clonar proposta
 </DropdownMenuItem>
 <DropdownMenuItem className="cursor-pointer gap-2">
 <FilePlus className="h-4 w-4" />
 Criar modelo
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 );
}
