# HU-20 — Entrada de mercadoria e saldo inicial

**Card pai:** 07 · **Prioridade:** 🟢 P2

## Narrativa

Como **dona**, quero dar entrada no estoque quando compro mercadoria (e lançar o saldo inicial do que já tá na prateleira), para o sistema saber o que tenho sem eu contar na mão.

## Critérios de aceite

- Tela de inventário lista produtos com estoque atual
- Ação "entrada de mercadoria": produto + quantidade (+ custo/fornecedor opcional) → soma no stock
- Lançamento de **saldo inicial** em massa (ela vai contar a prateleira uma vez)
- Histórico de entradas (auditoria: quem lançou, quando, quanto)
- Produto sem controle (stock NULL) pode ser ativado

## Notas técnicas

- `products.stock` existe e baixa automático em orders — falta endpoint de entrada/restock
- `POST /api/products/:id/stock` {quantity, type:'in'|'adjust'|'initial', note}
- Campo opcional `cost_price`/`supplier` pra financeiro/margem (avaliar)
- `min_stock` alimenta HU-21
- Tela `dashboard/inventory` existe — estender
