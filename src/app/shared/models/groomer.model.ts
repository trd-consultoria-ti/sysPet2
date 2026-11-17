export interface Groomer {
  id: number;
  name: string;
  phone: string;
  active: boolean;
  commissionRate: number; // Padrão 15%
  userId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroomerCommissionItem {
  serviceId: number;
  date: string;
  petName: string;
  customerName: string;
  serviceName: string;
  servicePrice: number;
  isPair: boolean;
  partnerGroomerName?: string;
  commissionRate: number; // 15% ou 7.5% se em dupla
  commissionAmount: number;
}

export interface GroomerCommissionReport {
  groomerId: number;
  groomerName: string;
  phone: string;
  totalServices: number;
  totalServiceRevenue: number;
  totalCommissionDue: number;
  items: GroomerCommissionItem[];
}
