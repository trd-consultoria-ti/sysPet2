# HU-27 — Consulta presencial por ordem de chegada

**Card pai:** 11 · **Prioridade:** ⚪ P3

## Narrativa

Como **recepção do consultório**, quero registrar a chegada do pet pra consulta na ordem de chegada (sem horário marcado), para organizar a fila igual ao banho/tosa.

## Critérios de aceite

- Check-in de consulta: tutor + pet + motivo → entra na fila do consultório
- Fila própria do consultório (separada do banho/tosa? ou unificada — decidir) com posição e status
- Consulta presencial por ordem de chegada (confirmado por Thaina)
- Ao chamar o pet, veterinário atenda e registre consulta (reusa `consultations`)
- Histórico do pet visível pro veterinário (consultas + vacinas anteriores)

## Notas técnicas

- `consultations` exige `scheduled_date`+`scheduled_time` — precisa aceitar modo "ordem de chegada" (scheduled_time='walkin' ou fila própria)
- Decisão: fila unificada (pet shop + consultório na mesma esteira) ou filas separadas por serviço — impacta HU-01/02
- Reusa `vets` (cadastro do veterinário fixo) e `consultations` (registro clínico)
- Depende da fila do dia (HU-01/02) estar pronta — pode herdar a esteira
