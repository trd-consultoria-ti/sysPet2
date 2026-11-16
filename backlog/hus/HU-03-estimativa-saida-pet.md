# HU-03 — Estimativa de saída do pet

**Card pai:** 01 · **Prioridade:** 🔴 P0

## Narrativa

Como **tutor**, quero saber aproximadamente que horas meu pet fica pronto, para não ficar no escuro nem reclamar de atraso.

## Critérios de aceite

- Cada pet na fila mostra estimativa de saída ("~14h30")
- Estimativa = agora + tempo dos pets à frente + tempo do próprio serviço
- Tempo médio por tipo de serviço configurável (banho ~X min, tosa ~Y min — **pendente resposta da Thaina**)
- Estimativa atualiza quando fila anda ou entra pet novo
- Opção de informar estimativa ao tutor na chegada e/ou via WhatsApp

## Notas técnicas

- Depende de HU-02 (fila) e da tabela de durações por serviço
- Durações iniciais podem ser estimativa nossa até Thaina confirmar tempos reais
- Guardar `estimated_ready_at` no check-in, recalculado a cada mudança de status
- Arredondar pra horário "cheio" (ex.: 14h30) — precisão falsa gera expectativa errada
