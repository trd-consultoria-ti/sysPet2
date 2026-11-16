# HU-28 — Consulta a domicílio agendada

**Card pai:** 11 · **Prioridade:** ⚪ P3

## Narrativa

Como **tutor**, quero agendar consulta do veterinário na minha casa com horário marcado, para casos em que não posso levar o pet.

## Critérios de aceite

- Agendamento de consulta a domicílio: data, horário, endereço do tutor, pet, motivo
- **Único fluxo do negócio que usa horário marcado** (confirmado)
- Veterinário vê agenda do dia com endereço e deslocamento
- Confirmação/lembrete ao tutor (WhatsApp — HU-16)
- Consulta a domicílio registrada como `consultation` com flag/local

## Notas técnicas

- `consultations` já tem `scheduled_date`+`scheduled_time` — **cabe no modelo atual**
- Falta: campo endereço/local (domicílio ≠ loja), tipo de atendimento (presencial/domicílio), talvez deslocamento
- `appointments` (mantido por decisão do dono) pode ser a porta de entrada do agendamento — ou consultations direto
- Preço do domicílio: ela vai mandar tabela — provável valor consulta + deslocamento
- Integra com `pets`, `customers`, `vets` existentes
