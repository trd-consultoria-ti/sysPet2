# HU-29 — Carteira de vacinas do pet

**Card pai:** 11 · **Prioridade:** ⚪ P3

## Narrativa

Como **veterinário e tutor**, quero ver a carteira de vacinas do pet — o que já tomou, quando, e quando é a próxima dose — para não perder reforço e ter histórico completo.

## Critérios de aceite

- Registro de vacina por pet: nome da vacina, data da aplicação, lote?, validade/próxima dose, veterinário
- Histórico cronológico de vacinas no cadastro do pet
- Alerta de vacina vencendo/vencida ("V8 do Rex venceu há 30 dias")
- Vacina aplicada numa consulta linka automaticamente à consulta
- Export/carteira pro tutor (PDF ou impressão — reusa gerador de PDF de prescriptions?)

## Notas técnicas

- Hoje vacinas seriam só texto em `consultations.reason`/`notes` — insuficiente pra carteira
- Nova entidade `vaccines`/`pet_vaccinations` (pet_id, name, applied_at, next_due_at, batch, vet_id, consultation_id?)
- `next_due_at` alimenta alertas e retorno do tutor
- Integrar com checklist de saúde (HU-05): "vacina em dia" pode ser observação na chegada
- Depende de módulo consultório estar ativo
