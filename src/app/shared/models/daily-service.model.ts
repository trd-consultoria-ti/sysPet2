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
  petWeightKg?: number | null;
  petSizeTier?: string;
  petImage?: string | null;
  serviceId?: number | null;
  serviceName: string;
  selectedExtras?: string[];
  date: string;
  queueOrder: number;
  status: DailyServiceStatus;
  healthChecklist: HealthChecklist;
  notes?: string;
  tosaNotes?: string;
  estimatedPrice: number;
  finalPrice?: number | null;
  cageNumber?: string;
  groomerName?: string;
  requiresValidation: boolean;
  validationConfirmed: boolean;
  validatedBy?: string | null;
  validatedAt?: string | null;
  checkinAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
  deliveredAt?: string | null;
  estimatedReadyAt?: string | null;
  paid?: boolean;
  paidAt?: string | null;
  paymentMethod?: string | null;
  hasTaxi?: boolean;
  taxiTripId?: string;
  taxiPrice?: number;
  taxiRegionId?: string;
  taxiRegionName?: string;
  taxiStatus?: 'a_caminho_buscar' | 'pet_na_loja' | 'a_caminho_devolver' | 'concluida';
  taxiDriverName?: string;
  taxiOriginAddress?: string;
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
  isClosed?: boolean;
}

export interface DailyQueueResponse {
  items: DailyService[];
  stats: DailyQueueStats;
}
