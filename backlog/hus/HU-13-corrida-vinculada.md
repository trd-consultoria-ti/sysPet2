# HU-13 — Corrida de táxi vinculada ao atendimento

**Card pai:** 04 · **Prioridade:** 🟡 P1

## Narrativa

Como **motorista ("o rapaz") e recepção**, quero registrar a corrida do táxi dog ligada ao atendimento do pet — endereço, região, preço e status — para saber quando buscar e quando devolver.

## Critérios de aceite

- Táxi dog só pode ser adicionado a atendimento de banho/tosa (regra confirmada)
- Corrida registra: endereço origem, bairro/região (resolve preço — HU-12), destino (a loja), observações (condomínio, portaria)
- Status da corrida: `a_caminho_buscar → pet_na_loja → a_caminho_devolver → concluida`
- Mudança de status dispara aviso WhatsApp pro tutor (HU-15)
- Valor da corrida entra no orçamento do atendimento (HU-10)
- Registro de quem dirigiu (comissão/controle)

## Notas técnicas

- Nova entidade `taxi_trips` vinculada ao check-in (1:N? ou 1:1 ida+volta — decidir: provavelmente 1 viagem ida + 1 volta, ou 1 registro com 2 trechos)
- Campos: checkin_id, origin_address, region_id, price, status, driver_id, timestamps
- Fluxo real observado: cliente confirma → "quando o rapaz estiver a caminho eu te aviso" → motorista busca → pet volta pra loja → devolve
- Pode haver táxi só ida ou só volta? Confirmar
