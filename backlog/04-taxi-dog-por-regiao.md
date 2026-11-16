# 04 — Táxi dog por região

**Prioridade:** P1 · Prioridade #3 declarada por ela

## Contexto e Motivação

Táxi dog é **exclusivo pra quem faz banho/tosa** (confirmado). Hoje é manual: cliente pede no WhatsApp → ela pede endereço + condomínio → identifica a região → cobra valor da tabela → avisa quando o motorista sai.

Preços reais observados: Riacho Fundo QC3 = R$10 · condomínios = R$15–30 · Recanto = R$20 · Ponte Alta Norte = R$20. **Motorista é próprio da casa** ("o rapaz"), não app.

## Narrativa

O táxi dog é um **item do orçamento** do banho/tosa (não corrida avulsa). O sistema pede endereço/bairro/condomínio, resolve a região numa tabela de preços e soma ao total. Status da corrida acompanha o atendimento: buscar na casa do tutor → chegar na loja → devolver.

## Critérios de aceite

- Cadastro de **regiões de atendimento** com preço (bairro/quadra/condomínio → valor)
- Fluxo coleta: endereço + ponto de referência/condomínio → resolve região → preço
- Táxi só pode ser adicionado a atendimento de banho/tosa (regra de negócio)
- Status da corrida visível: `a caminho (buscar)` → `pet na loja` → `a caminho (devolver)`
- Aviso WhatsApp "motorista a caminho" (integra card 05)
- Corrida registrada no financeiro (item do orçamento — card 03)

## Notas técnicas

- Hoje `catalog_services` tem "Taxi Dog R$49,90" flat — substituir por precificação por região.
- Nova entidade `taxi_trips` ou campos no check-in: origin_address, neighborhood, condo, region_id, price, status, driver_id.
- Tabela de regiões editável (ela conhece a malha de Riacho Fundo/Ponte Alta/etc).
- Pendente: confirmar se valor é por região fechada ou varia por distância dentro da região — ela citou "quadras".
