export interface PrescriptionItem {
  id?: number;
  medication: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface Prescription {
  id: number;
  consultationId: number;
  vetId?: number | null;
  vetName?: string | null;
  vetCrmv?: string | null;
  petName?: string;
  customerName?: string;
  issuedAt: string;
  notes?: string;
  items: PrescriptionItem[];
}
