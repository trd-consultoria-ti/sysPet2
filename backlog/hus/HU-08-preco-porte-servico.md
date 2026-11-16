# HU-08 — Preço por porte e serviço

**Card pai:** 02 · **Prioridade:** 🔴 P0

## Narrativa

Como **atendente**, quero que o sistema calcule o preço do serviço pelo porte do pet, para responder o cliente na hora sem consultar papel.

## Critérios de aceite

- Matriz de preços configurável: serviço (banho, tosa higiênica, tosa geral, tosa baby) × porte → valor
- Valores reais da tabela 2026: pequeno 50/60/70/80 · médio 75/90/110/? · médio/grande 110/130/160/? · grande 140/170/210/?
- Admin edita a tabela sem programador
- Cotação retorna: serviço + porte + valor unitário
- Mesma matriz alimenta vitrine pública e sugestões WhatsApp (HU-16)

## Notas técnicas

- Substituir `catalog_services.price` flat por tabela de regras:
  - Opção A: `price_rules(service_id, size_tier, price)` — normalizado
  - Opção B: JSONB matrix no service — simples mas menos flexível
- `GET /api/services` (público) deve expor matriz ou endpoint `/api/pricing/quote?pet_id=&service=`
- Pendências Thaina: tosa baby p/ portes médios+ (foto ilegível), confirmar valores
- Raça especial = HU-09 (override)
