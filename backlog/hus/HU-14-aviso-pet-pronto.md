# HU-14 — Aviso automático "pet pronto"

**Card pai:** 05 · **Prioridade:** 🟡 P1

## Narrativa

Como **tutor**, quero receber um WhatsApp quando meu pet ficar pronto, para buscar na hora sem ligar nem perguntar — hoje a Thaina manda manualmente.

## Critérios de aceite

- Ao mudar status do atendimento pra `pronto`, sistema envia WhatsApp pro tutor automaticamente
- Mensagem pronta e configurável: "Olá! Seu pet {nome} está pronto pra retirada 🐾" (template editável)
- Funciona pra quem tem WhatsApp cadastrado no cliente
- Falha de envio não trava o fluxo (loga e permite reenvio manual)
- Registro da notificação no histórico do cliente

## Notas técnicas

- Evolution API local (`127.0.0.1:8080`, instância `thiago-job-hunter`) — webhook/REST de envio já provado na entrevista
- Trigger: `PATCH /api/daily/:id/status` → status='pronto' → enqueue msg
- Telefone do tutor: `customers.phone` — normalizar formato BR (61 9XXXX-XXXX → JID)
- LID: msgs dela chegam por `@lid` — envio pro tutor comum usa JID telefone normal
- Mensagem transacional (status do serviço) — sem risco de opt-in LGPD
- Fila de envio com retry simples; não bloquear request HTTP
