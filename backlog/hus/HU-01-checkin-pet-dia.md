# HU-01 — Check-in do pet no dia

**Card pai:** 01 · **Prioridade:** 🔴 P0

## Narrativa

Como **recepcionista**, quero registrar a chegada do pet no dia (tutor, pet, procedimento, observações), para que ele entre na fila do dia sem depender de papel.

## Critérios de aceite

- Tela/balcão de check-in: buscar tutor por telefone/nome → selecionar pet → escolher procedimento (banho, tosa higiênica/geral/baby, extras)
- Check-in gera registro do dia com hora de entrada e entra no fim da fila
- Campos obrigatórios: tutor, pet, procedimento; opcionais: observações, telefone alternativo
- Pet com atendimento ativo não pode ter check-in duplicado no mesmo dia
- Após check-in, sistema mostra posição na fila e pode imprimir/mostrar ficha digital do pet (substitui a ficha de papel na gaiola)

## Notas técnicas

- Entidade nova (ex.: `daily_checkins`) — NÃO reusar `appointments` (que exige data futura)
- Reusa `customers`/`pets` existentes; pet precisa `weight_kg` pra cotar (HU-07)
- Índice único parcial: 1 check-in ativo por pet por dia
- `status`: `aguardando → em_atendimento → pronto → entregue | cancelado`
