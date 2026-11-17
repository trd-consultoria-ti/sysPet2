export interface TaxiRegion {
  id: string;
  name: string;
  aliases: string[];
  price: number;
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TaxiTripStatus = 'a_caminho_buscar' | 'pet_na_loja' | 'a_caminho_devolver' | 'concluida';
export type TaxiTripType = 'ida_e_volta' | 'somente_ida' | 'somente_volta';

export interface TaxiTrip {
  id: string;
  checkinId?: string;
  petId?: number;
  petName: string;
  customerName: string;
  customerPhone?: string;
  tripType: TaxiTripType;
  originAddress: string;
  regionId: string;
  regionName: string;
  price: number;
  driverName: string;
  status: TaxiTripStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const TAXI_STATUS_LABELS: Record<TaxiTripStatus, { label: string; class: string; icon: string }> = {
  a_caminho_buscar: { label: 'A caminho de buscar', class: 'status-seeking', icon: 'fa-car-side' },
  pet_na_loja: { label: 'Pet na loja', class: 'status-at-store', icon: 'fa-store' },
  a_caminho_devolver: { label: 'A caminho de devolver', class: 'status-returning', icon: 'fa-route' },
  concluida: { label: 'Concluída', class: 'status-done', icon: 'fa-check-circle' }
};
