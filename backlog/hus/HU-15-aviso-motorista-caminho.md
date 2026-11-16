# HU-15 — Aviso "motorista a caminho"

**Card pai:** 05 · **Prioridade:** 🟡 P1

## Narrativa

Como **tutor**, quero ser avisado quando o motorista do táxi dog sair pra me buscar e quando estiver voltando com o pet, para ficar pronto pro horário.

## Critérios de aceite

- Status `a_caminho_buscar` da corrida → WhatsApp "nosso motorista está a caminho"
- Status `a_caminho_devolver` → WhatsApp "pet a caminho de volta"
- Mensagens configuráveis, com nome do pet e horário estimado se houver
- Mesmo canal/mecanismo da HU-14 (notificações transacionais)

## Notas técnicas

- Depende de HU-13 (corrida com status) e HU-14 (infra de envio)
- Um template de notificação genérico resolve os dois casos — parametrizar por evento
- Agrupar envios se tutor tiver 2 pets no táxi (edge case)
