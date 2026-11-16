# HU-02 — Quadro da fila com posição e status

**Card pai:** 01 · **Prioridade:** 🔴 P0

## Narrativa

Como **recepção e tosadores**, quero ver a fila do dia em tempo real — quem tá na frente, quem tá sendo atendido, quem já tá pronto — para organizar o trabalho e responder o tutor sem chute.

## Critérios de aceite

- Quadro do dia lista todos os check-ins ordenados por entrada: pet, tutor, procedimento, status, tempo de espera
- Status visuais: aguardando / em atendimento / pronto / entregue
- Contadores: "X pets na fila · Y em atendimento · Z prontos"
- Ao mudar status (iniciar atendimento, marcar pronto), o quadro atualiza pra todos os dispositivos
- Visão filtrada por status (ex.: tosador vê só os dele)

## Notas técnicas

- Endpoint `GET /api/daily?date=...` + `PATCH /api/daily/:id/status`
- Front: tela nova no dashboard (hoje `admin-appointments` é booking — criar `daily-board`)
- Realtime: polling simples basta (pet shop, ~50 pets/dia); WebSocket é overkill no MVP
- "Pronto" é o gatilho da notificação WhatsApp (HU-14)
