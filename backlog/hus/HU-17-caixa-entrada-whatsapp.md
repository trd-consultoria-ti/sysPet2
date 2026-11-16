# HU-17 — Caixa de entrada WhatsApp no sistema

**Card pai:** 05 · **Prioridade:** 🟡 P1 · Fase 2 provável

## Narrativa

Como **atendente**, quero ver e responder as conversas de WhatsApp dos clientes dentro do próprio sistema, para não alternar entre WhatsApp e sistema o dia todo.

## Critérios de aceite

- Lista de conversas WhatsApp dentro do dashboard (cliente ↔ loja)
- Responder texto/imagem direto do sistema (via Evolution API)
- Conversa vinculada ao cadastro do cliente (histórico junto)
- Notificações de mensagem nova (badge/som)
- Atendente pode assumir conversa da colega (múltiplos atendentes — recepção + ela)

## Notas técnicas

- Evolution API: webhook `messages.upsert` → persistir em `wa_messages` (remote_jid, from_me, body, media_url, timestamp, customer_id?)
- Envio: `POST /message/sendText/{instance}` — já provado
- LID: mensagens podem chegar por `@lid` — resolver/normalizar contato
- Cuidado: instância é WhatsApp comum não-oficial — volume baixo ok, mas não fazer disparo em massa
- Áudio recebido: guardar referência de mídia; transcrição fase 2
- Escopo MVP pode ser só notificações (HU-14/15) + sugestões (HU-16) sem inbox completa — decidir corte
