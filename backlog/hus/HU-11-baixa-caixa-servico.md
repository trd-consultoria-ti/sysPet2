# HU-11 — Baixa no caixa da venda de serviço

**Card pai:** 03 · **Prioridade:** 🔴 P0

## Narrativa

Como **financeiro (Thaina)**, quero que toda venda de serviço entre no caixa automaticamente, para o fechamento bater sem lançar na mão.

## Critérios de aceite

- Fechar orçamento → gera `cash_movements` entrada (tipo serviço) com itens e total
- Pagamento registra forma (pix/cartão/dinheiro — **pendente resposta dela**)
- Venda de serviço + produto no mesmo dia consolidam no fechamento
- Cancelamento/estorno de venda gera movimento inverso ou marca estornado
- Relatório do dia separa: serviços (banho/tosa) · táxi · produtos · outros

## Notas técnicas

- Reusar fluxo de `POST /api/orders`: hoje insere cash_movement 'entrada' automático — estender p/ itens tipo service
- `payment_method` já existe em orders/cash_movements
- Atenção ao CHECK `amount > 0` (pedido 100% cupom não gera movimento — manter regra)
- Comissão dos tosadores (HU-19) calcula em cima do serviço — amarrar aqui
