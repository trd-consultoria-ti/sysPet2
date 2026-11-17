import { Injectable } from '@angular/core';
import { PetSizeTier, getPetSizeTier, getPetSizeLabel } from '../models/pet.model';

export interface ExtraServiceOption {
  id: string;
  name: string;
  price: number;
  durationMin: number;
  description: string;
}

export interface PricingQuote {
  serviceName: string;
  sizeTier: PetSizeTier;
  sizeLabel: string;
  weightKg?: number;
  breed?: string;
  breedOverrideApplied: boolean;
  basePrice: number;
  baseDurationMin: number;
  extras: { id: string; name: string; price: number; durationMin: number }[];
  extrasTotal: number;
  taxiPrice?: number;
  taxiRegionName?: string;
  totalDurationMin: number;
  totalPrice: number;
}

export interface BusinessDayConfig {
  dayOfWeek: number; // 0=Dom, 1=Seg... 6=Sab
  dayName: string;
  isOpen: boolean;
  capacity: number;
  openTime: string;
  closeTime: string;
}

const STORAGE_KEY_PRICING_CONFIG = 'syspet_pricing_matrix_v1';
const STORAGE_KEY_BUSINESS_HOURS = 'syspet_business_hours_v1';

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  // 1. Tabela Matriz Base: Serviço x Porte
  private defaultMatrix: Record<string, Record<PetSizeTier, number>> = {
    'banho completo': { pequeno: 50, medio: 75, medio_grande: 110, grande: 140 },
    'banho': { pequeno: 50, medio: 75, medio_grande: 110, grande: 140 },
    'tosa higiênica': { pequeno: 60, medio: 90, medio_grande: 130, grande: 170 },
    'tosa higienica': { pequeno: 60, medio: 90, medio_grande: 130, grande: 170 },
    'tosa geral': { pequeno: 70, medio: 110, medio_grande: 160, grande: 210 },
    'tosa baby': { pequeno: 80, medio: 120, medio_grande: 170, grande: 220 },
    'tosa da raça': { pequeno: 75, medio: 115, medio_grande: 165, grande: 215 },
    'hidratação': { pequeno: 35, medio: 45, medio_grande: 55, grande: 70 },
    'hidratacao': { pequeno: 35, medio: 45, medio_grande: 55, grande: 70 }
  };

  // Durações base em minutos: Serviço x Porte
  private defaultDurations: Record<string, Record<PetSizeTier, number>> = {
    'banho completo': { pequeno: 40, medio: 50, medio_grande: 60, grande: 75 },
    'banho': { pequeno: 40, medio: 50, medio_grande: 60, grande: 75 },
    'tosa higiênica': { pequeno: 50, medio: 65, medio_grande: 75, grande: 90 },
    'tosa higienica': { pequeno: 50, medio: 65, medio_grande: 75, grande: 90 },
    'tosa geral': { pequeno: 70, medio: 90, medio_grande: 110, grande: 130 },
    'tosa baby': { pequeno: 80, medio: 100, medio_grande: 120, grande: 140 },
    'tosa da raça': { pequeno: 75, medio: 95, medio_grande: 115, grande: 135 },
    'hidratação': { pequeno: 20, medio: 25, medio_grande: 30, grande: 35 },
    'hidratacao': { pequeno: 20, medio: 25, medio_grande: 30, grande: 35 }
  };

  // 2. Raças Especiais com tabela própria (sobrescrevem porte)
  private breedOverrides: { pattern: RegExp; name: string; prices: Record<string, number> }[] = [
    {
      pattern: /spitz|lulu/i,
      name: 'Spitz Alemão / Lulu',
      prices: {
        'banho': 60, 'banho completo': 60,
        'tosa higiênica': 70, 'tosa higienica': 70,
        'tosa geral': 90, 'tosa baby': 90, 'tosa da raça': 90
      }
    },
    {
      pattern: /chow\s*chow|chowchow/i,
      name: 'Chow-Chow',
      prices: {
        'banho': 150, 'banho completo': 150,
        'tosa higiênica': 190, 'tosa higienica': 190,
        'tosa geral': 210, 'tosa baby': 210
      }
    },
    {
      pattern: /husky|akita|malamute/i,
      name: 'Husky / Akita',
      prices: {
        'banho': 140, 'banho completo': 140,
        'tosa higiênica': 160, 'tosa higienica': 160,
        'tosa geral': 200, 'tosa baby': 200
      }
    },
    {
      pattern: /golden|labrador|pastor|bernese|samoyeda|border collie/i,
      name: 'Pelagem Longa / Porte Gigante',
      prices: {
        'banho': 120, 'banho completo': 120,
        'tosa higiênica': 140, 'tosa higienica': 140,
        'tosa geral': 180, 'tosa baby': 180
      }
    }
  ];

  // 3. Serviços Extras Somáveis
  readonly availableExtras: ExtraServiceOption[] = [
    { id: 'luvinha', name: 'Luvinha de Silicone / Higiene', price: 10, durationMin: 5, description: 'Proteção delicada e corte anatômico das patinhas' },
    { id: 'desembolo', name: 'Desembolo de Nós', price: 50, durationMin: 25, description: 'Remoção cuidadosa de nós com fluido hidratante' },
    { id: 'unhas', name: 'Corte e Lixamento de Unhas', price: 15, durationMin: 10, description: 'Corte anatômico de unhas com acabamento lixado' },
    { id: 'ouvidos', name: 'Higienização Auricular Profunda', price: 20, durationMin: 10, description: 'Limpeza de ouvidos com loção antisséptica' },
    { id: 'dentes', name: 'Escovação de Dentes', price: 25, durationMin: 10, description: 'Escovação profilática com gel enzimático sabor carne' },
    { id: 'hidratacao_ozonio', name: 'Hidratação de Ozônio', price: 35, durationMin: 15, description: 'Banho de ozônio para brilho e maciez extrema do pelo' }
  ];

  // 4. Expediente & Horários (HU-04 e HU-26)
  private defaultBusinessDays: BusinessDayConfig[] = [
    { dayOfWeek: 0, dayName: 'Domingo', isOpen: false, capacity: 0, openTime: '', closeTime: '' },
    { dayOfWeek: 1, dayName: 'Segunda-feira', isOpen: true, capacity: 50, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 2, dayName: 'Terça-feira', isOpen: true, capacity: 50, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 3, dayName: 'Quarta-feira', isOpen: true, capacity: 50, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 4, dayName: 'Quinta-feira', isOpen: true, capacity: 50, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 5, dayName: 'Sexta-feira', isOpen: true, capacity: 50, openTime: '08:00', closeTime: '18:00' },
    { dayOfWeek: 6, dayName: 'Sábado', isOpen: true, capacity: 32, openTime: '08:00', closeTime: '16:00' }
  ];

  constructor() {}

  // -------------------------------------------------------------
  // Precificação Automática (HU-08 / HU-09)
  // -------------------------------------------------------------
  calculateQuote(
    serviceName: string,
    weightKg?: number | null,
    breed?: string | null,
    selectedExtraIds: string[] = [],
    taxiPrice = 0,
    taxiRegionName = ''
  ): PricingQuote {
    const sizeTier = getPetSizeTier(weightKg);
    const sizeLabel = getPetSizeLabel(sizeTier);
    const normService = (serviceName || 'Banho Completo').trim().toLowerCase();

    // Verifica override por raça
    let basePrice: number | null = null;
    let breedOverrideApplied = false;
    let appliedBreedName = '';

    if (breed) {
      for (const override of this.breedOverrides) {
        if (override.pattern.test(breed)) {
          // Busca preço correspondente
          for (const sKey of Object.keys(override.prices)) {
            if (normService.includes(sKey) || sKey.includes(normService)) {
              basePrice = override.prices[sKey];
              breedOverrideApplied = true;
              appliedBreedName = override.name;
              break;
            }
          }
          if (breedOverrideApplied) break;
        }
      }
    }

    // Se não houver override de raça, usa tabela do porte
    if (basePrice === null) {
      const matchKey = Object.keys(this.defaultMatrix).find(k => normService.includes(k) || k.includes(normService));
      if (matchKey && this.defaultMatrix[matchKey]) {
        basePrice = this.defaultMatrix[matchKey][sizeTier] || 60;
      } else {
        basePrice = 70; // fallback padrão
      }
    }

    // Duração base
    let baseDurationMin = 45;
    const durKey = Object.keys(this.defaultDurations).find(k => normService.includes(k) || k.includes(normService));
    if (durKey && this.defaultDurations[durKey]) {
      baseDurationMin = this.defaultDurations[durKey][sizeTier] || 45;
    }

    // Extras somáveis
    const chosenExtras: { id: string; name: string; price: number; durationMin: number }[] = [];
    let extrasTotal = 0;
    let extrasDuration = 0;

    for (const exId of selectedExtraIds) {
      const extra = this.availableExtras.find(e => e.id === exId);
      if (extra) {
        chosenExtras.push({ id: extra.id, name: extra.name, price: extra.price, durationMin: extra.durationMin });
        extrasTotal += extra.price;
        extrasDuration += extra.durationMin;
      }
    }

    return {
      serviceName: serviceName || 'Banho Completo',
      sizeTier,
      sizeLabel,
      weightKg: weightKg || undefined,
      breed: breed || undefined,
      breedOverrideApplied,
      basePrice,
      baseDurationMin,
      extras: chosenExtras,
      extrasTotal,
      taxiPrice: taxiPrice > 0 ? taxiPrice : undefined,
      taxiRegionName: taxiPrice > 0 ? taxiRegionName : undefined,
      totalDurationMin: baseDurationMin + extrasDuration,
      totalPrice: basePrice + extrasTotal + (taxiPrice || 0)
    };
  }

  // -------------------------------------------------------------
  // Cálculo de Previsão de Saída (ETA — HU-03)
  // -------------------------------------------------------------
  estimateReadyTime(
    checkinDate: Date | string,
    serviceDurationMin: number,
    petsAheadCount: number = 0,
    activeStations: number = 2 // bancadas simultâneas de banho/tosa
  ): { readyDate: Date; formattedTime: string; waitMinutes: number } {
    const baseTime = typeof checkinDate === 'string' ? new Date(checkinDate) : new Date(checkinDate);
    // Tempo da fila à frente dividido pela quantidade de profissionais/bancadas operando em paralelo
    const queueWaitMin = Math.round((petsAheadCount * 35) / Math.max(1, activeStations));
    const totalMinutes = queueWaitMin + serviceDurationMin;

    const readyDate = new Date(baseTime.getTime() + totalMinutes * 60000);

    // Arredonda para múltiplo amigável de 5 minutos
    const rem = readyDate.getMinutes() % 5;
    if (rem !== 0) {
      readyDate.setMinutes(readyDate.getMinutes() + (5 - rem));
    }
    readyDate.setSeconds(0);

    const hours = String(readyDate.getHours()).padStart(2, '0');
    const mins = String(readyDate.getMinutes()).padStart(2, '0');

    return {
      readyDate,
      formattedTime: `${hours}h${mins}`,
      waitMinutes: totalMinutes
    };
  }

  // -------------------------------------------------------------
  // Expediente & Horários (HU-04 e HU-26)
  // -------------------------------------------------------------
  getBusinessHours(): BusinessDayConfig[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BUSINESS_HOURS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [...this.defaultBusinessDays];
  }

  saveBusinessHours(configs: BusinessDayConfig[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_BUSINESS_HOURS, JSON.stringify(configs));
    } catch {}
  }

  getDayConfig(dateStr?: string): BusinessDayConfig {
    const date = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
    const dayOfWeek = date.getUTCDay();
    const list = this.getBusinessHours();
    return list.find(d => d.dayOfWeek === dayOfWeek) || this.defaultBusinessDays[dayOfWeek];
  }

  isDayClosed(dateStr?: string): boolean {
    const cfg = this.getDayConfig(dateStr);
    return !cfg.isOpen;
  }

  getCapacity(dateStr?: string): number {
    const cfg = this.getDayConfig(dateStr);
    return cfg.isOpen ? cfg.capacity : 0;
  }
}
