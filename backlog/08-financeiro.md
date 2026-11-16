# 08 — Financeiro: contas a pagar + visão do dia

**Prioridade:** P2 · Ela é o financeiro inteiro e faz na mão

## Contexto e Motivação

> "O financeiro sou eu, que cuido tudo manualmente — vendas, contas a pagar e comissão dos tosadores"

`cash_movements` existe (entrada/saída manual + export CSV pro contador, só admin). Mas: contas a pagar não têm fluxo próprio (só lançamento manual genérico), comissões não existem (card 06), e a visão é de admin — não tem "fechamento do dia" operacional.

## Narrativa

O financeiro dela no sistema: **entradas** automáticas de toda venda (serviço+produto+táxi), **saídas** de contas a pagar (fornecedor, aluguel, etc.) com vencimento, e **comissões a pagar** calculadas (card 06). Fechamento do dia: quanto entrou, quanto saiu, saldo.

## Critérios de aceite

- Lançamento de conta a pagar: descrição, valor, vencimento, status (previsto/pago), categoria
- Entradas de venda aparecem automaticamente vinculadas (já funciona via orders → cash_movements; estender p/ serviços — card 03)
- Comissões calculadas aparecem como contas a pagar previstas (card 06)
- Fechamento do dia/semana/mês: total entradas, saídas, saldo, por forma de pagamento
- Export CSV pro contador (já existe — estender p/ contas a pagar)
- Permissão: papel financeiro (ela) vê tudo; recepção vê só o necessário

## Notas técnicas

- `cash_movements` já cobre o lançamento; falta entidade `payables` (contas a pagar) com due_date/status, ou estender cash_movements com tipo específico.
- Relatórios: `/api/reports` existe (admin) — verificar cobertura e estender.
- Forms de pagamento: pix/cartão/dinheiro — depende da resposta pendente com Thaina.
