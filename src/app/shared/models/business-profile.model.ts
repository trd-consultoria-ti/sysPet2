export interface BusinessProfile {
  tradeName: string;
  legalName: string;
  cnpj: string;
  ie?: string;
  addressLine: string;
  city: string;
  uf: string;
  cep: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram?: string;
  website?: string;
}

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  tradeName: 'Animal World Pet Shop & Clínica Veterinária',
  legalName: 'Animal World Comércio e Serviços Veterinários Ltda',
  cnpj: '45.123.456/0001-89',
  ie: '07.999.888/001-20',
  addressLine: 'QC 3 Conjunto 1 Lote 5 — Riacho Fundo I',
  city: 'Brasília',
  uf: 'DF',
  cep: '71805-403',
  phone: '(61) 3399-1234',
  whatsapp: '(61) 98888-7777',
  email: 'contato@animalworldpet.com.br',
  instagram: '@animalworldpetshop',
  website: 'https://trd-consultoria-ti.github.io/sysPet2/'
};
