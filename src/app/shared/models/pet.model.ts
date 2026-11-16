export type PetSizeTier = 'pequeno' | 'medio' | 'medio_grande' | 'grande';

export interface Pet {
  id?: number;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  weightKg?: number;
  customerId: number;
}

export function getPetSizeTier(weightKg?: number | null): PetSizeTier {
  const w = Number(weightKg) || 0;
  if (w <= 10) return 'pequeno';
  if (w <= 15) return 'medio';
  if (w <= 20) return 'medio_grande';
  return 'grande';
}

export function getPetSizeLabel(tier: PetSizeTier): string {
  switch (tier) {
    case 'pequeno': return 'Pequeno (até 10kg)';
    case 'medio': return 'Médio (10 a 15kg)';
    case 'medio_grande': return 'Médio/Grande (15 a 20kg)';
    case 'grande': return 'Grande (> 20kg)';
  }
}
