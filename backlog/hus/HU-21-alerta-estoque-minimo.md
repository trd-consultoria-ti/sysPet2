# HU-21 — Alerta de estoque mínimo

**Card pai:** 07 · **Prioridade:** 🟢 P2

## Narrativa

Como **dona**, quero ser avisada quando um produto estiver acabando, para comprar antes de faltar na prateleira — em vez de descobrir quando o cliente pede.

## Critérios de aceite

- Cada produto tem `min_stock` configurável
- Produto com stock <= min_stock aparece em lista de "estoque baixo" no dashboard
- Opcional: notificação (WhatsApp/e-mail) quando atingir mínimo
- Contagem de "ruptura" (stock = 0) destacada

## Notas técnicas

- `products.min_stock INTEGER` + query `stock <= min_stock AND stock IS NOT NULL`
- Badge na tela inventory + card no dashboard-home
- Notificação externa opcional (reusa infra WhatsApp da HU-14 se quiser — mas é interno, talvez e-mail baste)
- Depende de HU-20 (stock real populado)
