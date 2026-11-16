# HU-22 — Venda de balcão (PDV)

**Card pai:** 07 · **Prioridade:** 🟢 P2

## Narrativa

Como **recepção**, quero vender ração/acessório/medicamento no balcão de forma rápida — cliente, itens, pagamento — para registrar a venda e baixar o estoque na hora.

## Critérios de aceite

- Tela PDV: busca produto → adiciona itens → total → forma de pagamento → finaliza
- Finalizar: gera pedido/venda + **baixa estoque** + entrada no caixa (reusar fluxo orders)
- Funciona pra cliente cadastrado ou venda rápida sem cadastro (balcão)
- Venda pode combinar produto + serviço do dia (ex.: ração + banho na mesma conta?) — decidir
- Imprime/comprovante opcional pro cliente

## Notas técnicas

- `POST /api/orders` já faz tudo isso (valida stock, decrementa, gera cash_movement) — PDV é basicamente a mesma API com UI simplificada
- Decisão: orders exige `user_id` (cliente logado) — balcão pode ser venda avulsa; staff cria order em nome do customer
- Ou PDV direto em `cash_movements` + baixa manual de stock — mais simples mas perde itemização
- Preferir reusar orders pra manter histórico e relatórios consistentes
