export interface Medication {
  id: number;
  name: string; // Nome comercial (ex: Apoquel 5.4mg, Bravecto, Meloxicam)
  activePrinciple: string; // Princípio ativo (ex: Oclacitinib, Fluralaner)
  category: string; // Antiparasitário, Antibiótico, Anti-inflamatório, Vermífugo, etc.
  presentation: string; // Comprimidos, Gotas, Pomada, Injetável, Xarope, etc.
  concentration?: string; // Ex: 5.4mg, 20mg/ml, 250mg
  price: number; // Preço de venda (R$)
  stock: number; // Quantidade em estoque
  unit?: string; // cx, un, frasco, ampola
  defaultDosage?: string; // Posologia padrão sugerida
  requiresPrescription: boolean; // Exige receita veterinária
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}
