export type OrderStatus = 'pendente' | 'pago' | 'cancelado' | 'entregue';

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id?: number;
  orderNumber: string;
  userId?: number;
  customerName: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentMethod?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
}
