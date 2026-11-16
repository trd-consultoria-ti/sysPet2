export type AppointmentStatus = 'solicitado' | 'confirmado' | 'concluido' | 'cancelado';

export interface Appointment {
  id?: number;
  userId?: number;
  userName?: string;
  customerId?: number;
  customerName?: string;
  petName: string;
  serviceId?: number;
  serviceName?: string;
  date: string;
  time: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: string;
}
