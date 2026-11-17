export type ConsultationStatus = 'agendado' | 'em_atendimento' | 'concluido' | 'cancelado';

export interface Consultation {
  id: number;
  petId: number;
  petName: string;
  petType?: string;
  petBreed?: string;
  customerId: number;
  customerName: string;
  vetId?: number | null;
  vetName?: string | null;
  vetCrmv?: string | null;
  vetSpecialty?: string | null;
  scheduledDate: string;
  scheduledTime?: string;
  status: ConsultationStatus;
  reason?: string;
  weight?: number | null;
  temperature?: number | null;
  diagnosis?: string;
  notes?: string;
  prescriptionId?: number;
  isWalkIn?: boolean;
  walkInQueueOrder?: number;
  triagePriority?: 'normal' | 'urgencia';
  createdBy?: number;
  createdAt: string;
  updatedAt?: string;
}
