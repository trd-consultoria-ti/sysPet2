# HU-05 — Checklist de saúde na chegada

**Card pai:** 01 · **Prioridade:** 🔴 P0

## Narrativa

Como **recepção**, quero registrar no check-in se o pet apresenta lesão de pele, parasitas, diarreia, vômito ou mal-estar — e informar o tutor — para proteger a loja e o pet.

## Critérios de aceite

- Check-in tem checklist estruturado: lesão de pele, parasitas, diarreia, vômito, mal-estar, lesão em pata (+ texto livre)
- Itens marcados geram mensagem pronta pro tutor ("Animal apresenta parasitas...") — confirmação/envio manual no MVP
- Observações ficam no histórico do pet (visível em atendimentos futuros e pro consultório)
- Ficha digital do pet (na gaiola/print) mostra alertas de saúde destacados

## Notas técnicas

- Campo `health_flags JSONB` + `health_notes TEXT` no check-in
- Mensagens modelo editáveis (ela já usa textos tipo "Animal apresenta lesão na pata")
- Histórico: agregável via `pets` → checkins anteriores
- Pergunta pendente: checklist vale pro consultório também?
