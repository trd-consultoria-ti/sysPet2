export type VaccineStatus = 'em_dia' | 'vencendo' | 'vencida';

export interface PetVaccine {
  id: number;
  petId: number;
  petName: string;
  customerName?: string;
  vaccineName: string;
  appliedAt: string;
  nextDueAt: string;
  batch?: string;
  manufacturer?: string;
  vetName?: string;
  vetCrmv?: string;
  consultationId?: number;
  notes?: string;
  status?: VaccineStatus;
}

export const COMMON_VACCINES: string[] = [
  'V8 / V10 Polivalente Canina',
  'Antirrábica (Raiva)',
  'Gripe Canina / Tosse dos Canis (Pneumodog)',
  'Giardíase (GiardiaVax)',
  'Leishmaniose (LeishTec)',
  'Quádrupla Felina (V4)',
  'Quíntupla Felina (V5)',
  'Antirrábica Felina'
];

export function calculateVaccineStatus(nextDueAt: string): VaccineStatus {
  if (!nextDueAt) return 'em_dia';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(nextDueAt);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'vencida';
  if (diffDays <= 30) return 'vencendo';
  return 'em_dia';
}
