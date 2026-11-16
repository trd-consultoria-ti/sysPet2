# HU-12 — Regiões de táxi com preço

**Card pai:** 04 · **Prioridade:** 🟡 P1

## Narrativa

Como **atendente**, quero cadastrar as regiões de atendimento do táxi dog com o preço de cada uma, para cotar na hora sem decorar a tabela.

## Critérios de aceite

- CRUD de regiões: nome (bairro/quadra/condomínio) + valor
- Regiões reais dela: Riacho Fundo QC3 = R$10 · condomínios R$15–30 · Recanto = R$20 · Ponte Alta Norte = R$20
- Busca por texto ("QS 3", "condomínio", nome do bairro) acha a região
- Região sem preço cadastrado → sistema avisa "cadastrar região" em vez de chutar
- Edição de preço sem programador

## Notas técnicas

- Nova entidade `taxi_regions` (name, aliases[], price, active)
- Aliases ajudam: cliente manda endereço completo, atendente escolhe a região correspondente
- Preço pode variar por direção (ida/volta?) — confirmar regra com Thaina
- Substitui o "Taxi Dog R$49,90" flat do catálogo — remover/ajustar seed
