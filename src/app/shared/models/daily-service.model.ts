export type DailyServiceStatus = 'aguardando' | 'em_atendimento' | 'pronto' | 'entregue' | 'cancelado';

export interface HealthChecklist {
  skin_lesion?: boolean;
  parasites?: boolean;
  paw_lesion?: boolean;
  vomiting_diarrhea?: boolean;
  general_malaise?: boolean;
  observations?: string;
}

export interface DailyService {
  id: number;
  appointmentId?: number | null;
  customerId?: number | null;
  customerName: string;
  phone: string;
  petId?: number | null;
  petName: string;
  petBreed?: string;
  petImage?: string | null;
  serviceId?: number | null;
  serviceName: string;
  date: string;
  queueOrder: number;
  status: DailyServiceStatus;
  healthChecklist: HealthChecklist;
  notes?: string;
  estimatedPrice: number;
  finalPrice?: number | null;
  cageNumber?: string;
  groomerName?: string;
  requiresValidation: boolean;
  validationConfirmed: boolean;
  checkinAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
  deliveredAt?: string | null;
  createdAt?: string;
}

export interface DailyQueueStats {
  date: string;
  capacity: number;
  totalToday: number;
  waiting: number;
  inProgress: number;
  ready: number;
  delivered: number;
  canceled: number;
  remainingSpots: number;
  isFull: boolean;
}

export interface DailyQueueResponse {
  items: DailyService[];
  stats: DailyQueueStats;
}
