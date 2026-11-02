# Tarefas agendadas (cron)

## O problema que este arquivo resolve

Até 02/11/2026 **não existia `vercel.json` no projeto**. A rota
`/api/cron/verificar-vencimentos` estava escrita, testada e protegida por
`CRON_SECRET` — e nunca era chamada por ninguém. Cron na Vercel não é
descoberto por convenção de pasta: ele só existe se estiver declarado em
`vercel.json`.

Era uma rota órfã: código correto, zero efeito. O mesmo valia para a
sincronização de metas, que só acontecia quando alguém clicava num botão.

## O que roda hoje

| Rota | Horário (UTC) | Horário em São Paulo | O que faz |
|---|---|---|---|
| `/api/cron/verificar-vencimentos` | 11:00 | 08:00 | Cria notificação de conta a vencer/vencida, por tenant |
| `/api/cron/sincronizar-metas` | 11:25 | 08:25 | Puxa o número de cada meta automática da fonte dela |

**Os horários são UTC.** A Vercel não aceita fuso no `schedule`, e o processo
roda em UTC — por isso `0 11` e não `0 8`. São 8h da manhã em São Paulo
(UTC−3), antes da loja abrir, o que é o ponto: quem chega já encontra as
notificações do dia e as metas atualizadas.

Os dois não rodam no mesmo minuto de propósito. Ambos percorrem todos os
tenants abrindo conexão com o Neon; sobrepor os dois dobraria o pico de
conexões sem necessidade nenhuma.

## Segurança

As duas rotas exigem `Authorization: Bearer $CRON_SECRET`. A Vercel envia
esse header automaticamente nos crons que ela mesma dispara.

Atenção à forma da checagem nas duas rotas:

```ts
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
}
```

Se `CRON_SECRET` **não estiver definida**, a rota fica **aberta** — o `&&`
deixa passar. Isso é deliberado para o ambiente local (dá para chamar no
navegador sem configurar nada), mas significa que **em produção a variável
tem que existir**. Sem ela, qualquer um na internet dispara a rota.

## Limite do plano

O plano Hobby da Vercel permite cron **uma vez por dia** por rota. Os dois
acima são diários, então cabem. Se um dia for preciso rodar de hora em hora
(por exemplo, metas que mudam ao longo do dia), isso exige plano Pro — ou
mover o agendamento para fora da Vercel.

## Como testar à mão

Com a aplicação rodando e `CRON_SECRET` definida:

```
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU_DOMINIO/api/cron/sincronizar-metas
```

A resposta diz quantos tenants foram processados, quantas metas foram
verificadas, quantas mudaram de valor e quais falharam — e uma falha de um
tenant não impede os outros.
