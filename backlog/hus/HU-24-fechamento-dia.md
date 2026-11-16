# HU-24 — Fechamento do dia

**Card pai:** 08 · **Prioridade:** 🟢 P2

## Narrativa

Como **financeiro**, quero um resumo do dia — quanto entrou por serviço/produto/táxi, quanto saiu, saldo — para fechar o caixa sem fazer conta na mão.

## Critérios de aceite

- Fechamento por dia: total entradas (serviços + produtos + táxi), total saídas, saldo
- Detalhamento por forma de pagamento (pix/cartão/dinheiro)
- Detalhamento por tipo: banho/tosa, táxi dog, produtos, outros
- Comparativo com dias anteriores (opcional)
- Export/compartilhamento do fechamento

## Notas técnicas

- Agrega `cash_movements` + orders do dia + service sales (HU-11)
- Relatórios existentes em `/api/reports` (admin) — verificar e estender
- Tela `admin-cash` + `admin-reports` do dashboard — adicionar visão "fechamento"
- Depende de HU-11 (serviços gerando caixa) e HU-23 (contas a pagar)
