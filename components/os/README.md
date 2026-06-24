# 📋 Módulo de Ordem de Serviço (OS)

## 📝 Visão Geral

Módulo completo para gerenciamento de ordens de serviço em uma oficina de manutenção de equipamentos. Inclui controle rigoroso de entrada de aparelhos (checklist), orçamento com motor de precificação automática baseado em regras de negócio, e fluxo de status visual em Kanban.

## 🎯 Funcionalidades

### 1. Dashboard Kanban (7 Colunas)
- **Aguardando Orçamento** - Equipamento recebido, análise em andamento
- **Aguardando Aprovação** - Orçamento enviado ao cliente
- **Aprovado** - Cliente aprovou o orçamento
- **Aguardando Peça** - Esperando chegada de componentes
- **Em Manutenção** - Trabalho sendo realizado
- **Pronto** - Manutenção concluída, testes OK
- **Entregue** - Equipamento entregue ao cliente

### 2. Aba: Entrada de Equipamento
- Seleção de cliente (combobox)
- Dados do aparelho (equipamento, marca, modelo, IMEI)
- Senha do aparelho (campo seguro)
- **Checklist Rigoroso:**
  - Relato do cliente (obrigatório)
  - Condição física do aparelho
  - Acessórios deixados

### 3. Aba: Orçamento & Precificação
- **Array dinâmico de itens** (adicionar/remover)
- Seleção de tipo de peça/serviço
- Descrição do item
- Custo da peça (input numérico)
- **Valor a Cobrar (Automático ou Manual)**

#### 💰 Engine de Precificação Automática

As regras de markup são aplicadas automaticamente ao mudar o "Custo da Peça":

| Tipo | Regra de Preço |
|------|---|
| **TELA** | ≤ R$150: 200% \| ≤ R$250: 175% \| > R$250: 150% |
| **BATERIA** | ≤ R$80: 200% \| ≤ R$140: 175% \| > R$140: 150% |
| **CONECTOR_CARGA** | Custo + R$100 |
| **TAMPA_IPHONE** | Custo + R$200 |
| **TAMPA_ANDROID** | Custo + R$80 |
| **OUTROS** | Manual (sem auto-cálculo) |

**Total do Orçamento** é exibido de forma destaque em gradiente verde.

### 4. Aba: Histórico & Status
- Dropdown para mudar status
- Campo de observações internas (não visível para cliente)
- Guia visual do fluxo de status recomendado

## 📁 Estrutura de Arquivos

```
src/
├── components/os/
│   ├── index.ts                          # Exportações
│   ├── dashboard-os.tsx                  # Container principal
│   ├── tabuleiro-kanban.tsx              # Kanban board
│   ├── coluna-kanban.tsx                 # Coluna individual
│   ├── cartao-os.tsx                     # Card da OS
│   ├── modal-nova-os.tsx                 # Modal com 3 abas
│   └── abas/
│       ├── aba-entrada-equipamento.tsx   # Aba 1
│       ├── aba-orcamento.tsx             # Aba 2
│       └── aba-historico-status.tsx      # Aba 3
├── types/
│   └── os.ts                             # Interfaces (OrdemServico, Cliente, etc)
├── dados/
│   └── mock-os.ts                        # Dados mock de teste
├── hooks/
│   └── useCalculadoraPrecosOS.ts         # Hook de precificação
├── lib/validations/
│   └── os.ts                             # Esquemas Zod
├── components/ui/
│   ├── textarea.tsx                      # Componente novo
│   └── scroll-area.tsx                   # Componente novo
app/
└── (dashboard)/os/
    └── page.tsx                          # Página principal (/os)
```

## 🔧 Tipos e Interfaces

### OrdemServico
```typescript
interface OrdemServico {
  id: string;
  numeroOS: string;
  clienteId: string;
  nomeCliente: string;
  equipamento: string;
  marca?: string;
  modelo?: string;
  numeroSerieImei?: string;
  senhaAcesso?: string;
  checklist: ChecklistEntrada;
  itensOrcamento: ItemOrcamento[];
  totalOrcamento: number;
  status: StatusOS;
  observacoesInternas?: string;
  dataCriacao: string;
  dataAtualizacao: string;
}
```

### StatusOS
```typescript
type StatusOS =
  | "AGUARDANDO_ORCAMENTO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO"
  | "AGUARDANDO_PECA"
  | "EM_MANUTENCAO"
  | "PRONTO"
  | "ENTREGUE";
```

## 🎨 Componentes Principais

### DashboardOS
Container principal que integra tudo:
- Action Bar (busca + botão Nova OS)
- Estatísticas (Total, Aguardando, Em Progresso, Entregues)
- Kanban board
- Modal Nova OS

### TabuleiroKanban
Grid com 7 colunas de status. Cada coluna exibe cards de OS com:
- Número da OS
- Nome do cliente
- Equipamento
- Total do orçamento (se houver)
- Data de atualização

### ModalNovaOS
Dialog shadcn max-w-5xl com 3 abas e validação Zod.

## 🧮 Hook: useCalculadoraPrecosOS

```typescript
const { 
  calcularValorCobrado,      // Calcula valor baseado em regra
  calcularTotalOrcamento,     // Soma total dos itens
  calcularMarkupPercentual    // Calcula markup %
} = useCalculadoraPrecosOS();
```

## 🌐 Rota de Acesso

- **URL:** `/os`
- **Menu:** Já configurado em `BarraLateral` como "Ordens de Serviço"

## 💡 Como Usar

### 1. Criar Nova OS
1. Clique em "Nova Ordem de Serviço"
2. **Aba 1 - Entrada de Equipamento:**
   - Selecione cliente
   - Preencha dados do aparelho
   - Descreva o relato do cliente
3. **Aba 2 - Orçamento:**
   - Clique "Adicionar Item"
   - Selecione tipo (Tela, Bateria, etc)
   - Digite descrição e custo
   - Valor a Cobrar é calculado automaticamente
4. **Aba 3 - Histórico & Status:**
   - Selecione status inicial
   - Adicione observações se necessário
5. Clique "Salvar Ordem de Serviço"

### 2. Kanban Board
- Visualize todas as OS por status
- Procure por número, cliente ou equipamento
- Clique em uma card para editar (funcionalidade futura)

## 📦 Dependências Utilizadas

- `react-hook-form` - Gerenciamento de formulários
- `@hookform/resolvers` - Resolução de schemas (Zod)
- `zod` - Validação de dados
- `shadcn/ui` - Componentes UI
- `lucide-react` - Ícones

## ⚙️ Configurações PT-BR

- **Localizador:** `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Datas:** `toLocaleDateString('pt-BR')`
- **Textos:** Todos em português brasileiro

## 🚀 Próximas Etapas (Sugestões)

1. Integração com backend (salvar no banco)
2. Edição de OS existentes
3. Geração de PDF do orçamento
4. Envio de orçamento via WhatsApp/Email
5. Drag-and-drop real entre colunas (react-beautiful-dnd)
6. Sistema de notificações
7. Histórico de alterações por OS
8. Relatórios e análises

---

**Criado:** 06/06/2026  
**Módulo:** Ordem de Serviço (OS)  
**Status:** ✅ Funcional
