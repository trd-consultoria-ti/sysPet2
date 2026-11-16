# 07 — Estoque de mercadoria (ração, medicamentos, acessórios)

**Prioridade:** P2 · Hoje ela não tem controle NENHUM

## Contexto e Motivação

> "Não há controle de estoque, é apenas olhando a prateleira — acabou o produto eu compro mais"

Vendem: ração, medicamentos (venda livre, sem receita — confirmado), acessórios. `products.stock` já existe e **baixa automaticamente** quando entra pedido — mas hoje está NULL (sem controle) e ninguém dá entrada de mercadoria.

## Narrativa

O sistema passa a ser o estoque de verdade: cadastro do produto com quantidade, entrada de mercadoria (compra), baixa automática na venda de balcão/pedido, e alerta quando estiver acabando. Ela olha o sistema em vez da prateleira.

## Critérios de aceite

- Produtos com `stock` preenchido (hoje NULL) — tela de inventário pra lançar saldo inicial
- **Entrada de mercadoria**: registrar compra (qtd, custo?, fornecedor) → aumenta stock — hoje não existe endpoint de entrada
- Alerta de estoque mínimo (configurável por produto)
- Venda de balcão baixa estoque na hora (PDV simples: cliente + itens + pagamento)
- Relatório: o que vende mais, o que tá parado
- Medicamentos: venda livre, sem fluxo de receita (confirmado)

## Notas técnicas

- Base pronta: `products.stock` + decremento atômico em `POST /api/orders` + tela `dashboard/inventory`.
- Faltam: endpoint de entrada/restock, campo `min_stock`, custo de compra (pra margem/financeiro), PDV rápido pro balcão (hoje orders é fluxo de e-commerce com carrinho).
- Decidir se venda de balcão reusa `orders` ou vira `cash_movements` direto com itens.
- Foto do produto já suportada (`image_path` + upload).
- **Tabela de preços de produtos:** preço fixo por item (confirmado por Thaina ~15:32) — ela vai enviar a tabela; cadastrar quando chegar. Sem variação por cliente/condição.
