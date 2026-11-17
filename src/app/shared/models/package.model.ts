export type PackageStatus = 'ativo' | 'esgotado' | 'expirado';

export interface PetPackage {
  id: number;
  petId?: number;
  petName: string;
  customerName: string;
  customerPhone?: string;
  packageName: string;
  totalBaths: number;
  usedBaths: number;
  totalGrooms: number;
  usedGrooms: number;
  price: number;
  purchaseDate: string;
  expirationDate: string;
  status: PackageStatus;
  notes?: string;
}

export interface PackagePreset {
  id: string;
  name: string;
  description: string;
  baths: number;
  grooms: number;
  price: number;
  validityDays: number;
  eligibleBreedsSummary: string;
}

export const PACKAGE_PRESETS: PackagePreset[] = [
  {
    id: 'pkg-4b-1t',
    name: 'Plano Mensal Clássico (4 Banhos + 1 Tosa Higiênica)',
    description: '1 banho por semana + 1 tosa higiênica no mês. Ideal para cães pequenos de pelagem contínua.',
    baths: 4,
    grooms: 1,
    price: 190.00,
    validityDays: 35,
    eligibleBreedsSummary: 'Shih-tzu, Yorkshire, Maltês, Poodle, Lhasa Apso (até 10kg)'
  },
  {
    id: 'pkg-4b',
    name: 'Plano 4 Banhos Semanais',
    description: '4 banhos completos com hidratação, secagem, escovação e perfume.',
    baths: 4,
    grooms: 0,
    price: 150.00,
    validityDays: 35,
    eligibleBreedsSummary: 'Todas as raças pequenas e médias'
  },
  {
    id: 'pkg-2b-1t',
    name: 'Plano Quinzenal (2 Banhos + 1 Tosa)',
    description: '2 banhos + 1 tosa higiênica ou da raça para manutenção.',
    baths: 2,
    grooms: 1,
    price: 120.00,
    validityDays: 30,
    eligibleBreedsSummary: 'Pets de porte pequeno e médio'
  }
];
