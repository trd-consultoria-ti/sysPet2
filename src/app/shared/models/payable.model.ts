export type PayableCategory = 'fornecedor' | 'aluguel' | 'insumo' | 'comissao' | 'servico' | 'outro';
export type PayableStatus = 'previsto' | 'pago' | 'cancelado';

export interface Payable {
  id: number;
  description: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  category: PayableCategory;
  supplier?: string;
  status: PayableStatus;
  paidAt?: string | null;
  paymentMethod?: string | null;
  cashMovementId?: number | null;
  groomerId?: number | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const PAYABLE_CATEGORY_LABELS: Record<PayableCategory, { label: string; icon: string; badgeClass: string }> = {
  fornecedor: { label: 'Fornecedor de Mercadorias', icon: 'fa-truck', badgeClass: 'badge-supplier' },
  aluguel: { label: 'Aluguel do Ponto / Condomínio', icon: 'fa-building', badgeClass: 'badge-rent' },
  insumo: { label: 'Insumos (Shampoo, Toalhas, Lâminas)', icon: 'fa-pump-soap', badgeClass: 'badge-supplies' },
  comissao: { label: 'Comissão de Tosador (15%)', icon: 'fa-cut', badgeClass: 'badge-commission' },
  servico: { label: 'Serviços Terceirizados / Energia / Água', icon: 'fa-bolt', badgeClass: 'badge-service' },
  outro: { label: 'Outras Despesas', icon: 'fa-receipt', badgeClass: 'badge-other' }
};
