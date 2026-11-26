import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

type PropsTableBody = React.HTMLAttributes<HTMLTableSectionElement> & {
  /** Listra linhas pares com bg-muted/30 — opt-in, pra não mudar tabelas já existentes sem pedir. */
  zebra?: boolean
}

const TableBody = React.forwardRef<HTMLTableSectionElement, PropsTableBody>(
  ({ className, zebra = false, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn(
        "[&_tr:last-child]:border-0",
        zebra && "[&_tr:nth-child(even)]:bg-muted/30",
        className
      )}
      {...props}
    />
  )
)
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

type PropsTableCell = React.TdHTMLAttributes<HTMLTableCellElement> & {
  /** Numero/valor — alinha à direita e aplica font-variant-numeric: tabular-nums (Fase 3-1, regra de tabela). */
  numerico?: boolean
}

const TableCell = React.forwardRef<HTMLTableCellElement, PropsTableCell>(
  ({ className, numerico = false, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-4 py-1.5 align-middle [&:has([role=checkbox])]:pr-0",
        numerico && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  )
)
TableCell.displayName = "TableCell"

/**
 * Linha "nenhum resultado" — ocupa a largura inteira da tabela (colSpan
 * precisa vir de quem chama, porque só quem monta o <TableHeader> sabe
 * quantas colunas existem).
 */
function TabelaVazia({
  colSpan,
  titulo = "Nada por aqui ainda",
  descricao,
  icone,
}: {
  colSpan: number
  titulo?: string
  descricao?: string
  icone?: React.ReactNode
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {icone}
          <p className="text-sm font-medium text-foreground">{titulo}</p>
          {descricao && <p className="text-xs">{descricao}</p>}
        </div>
      </TableCell>
    </TableRow>
  )
}

/** Esqueleto de carregamento — mesma forma de uma tabela real, sem dado nenhum ainda. */
function TabelaCarregando({ colunas, linhas = 5 }: { colunas: number; linhas?: number }) {
  return (
    <>
      {Array.from({ length: linhas }).map((_, indiceLinha) => (
        <TableRow key={indiceLinha} className="hover:bg-transparent">
          {Array.from({ length: colunas }).map((_, indiceColuna) => (
            <TableCell key={indiceColuna}>
              <div className="h-4 w-full max-w-32 animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TabelaVazia,
  TabelaCarregando,
}
