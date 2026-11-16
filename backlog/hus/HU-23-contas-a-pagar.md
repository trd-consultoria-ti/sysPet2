# HU-23 — Contas a pagar com vencimento

**Card pai:** 08 · **Prioridade:** 🟢 P2

## Narrativa

Como **financeiro (Thaina)**, quero cadastrar contas a pagar com vencimento e marcar quando paguei, para não esquecer fornecedor/aluguel e saber o que vence.

## Critérios de aceite

- CRUD de conta a pagar: descrição, valor, vencimento, categoria (fornecedor, aluguel, insumo, comissão, outro)
- Status: `previsto → pago` (+ cancelado)
- Lista ordenada por vencimento com destaque do que tá vencendo/vencido
- Ao marcar pago: gera saída no `cash_movements` automaticamente
- Comissões de tosadores (HU-19) aparecem como contas a pagar previstas do período
- Alertas de vencimento (dashboard)

## Notas técnicas

- Nova entidade `payables` (description, amount, due_date, category, status, cash_movement_id?)
- Alternativa: estender `cash_movements` com due_date/status — mas conta a pagar tem ciclo de vida próprio; entidade separada é mais limpa
- Integrar com `cash_movements` tipo 'saida' no pagamento efetivo
- Export CSV do financeiro deve incluir contas a pagar
