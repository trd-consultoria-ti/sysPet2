export interface Vet {
  id: number;
  userId?: number | null;
  name: string;
  crmv?: string;
  specialty?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
}
