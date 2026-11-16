import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Consultation, ConsultationStatus } from '../../../shared/models/consultation.model';
import { Prescription, PrescriptionItem } from '../../../shared/models/prescription.model';
import { Vet } from '../../../shared/models/vet.model';
import { Pet } from '../../../shared/models/pet.model';
import { ConsultationService } from '../../../shared/services/consultation.service';
import { VetService } from '../../../shared/services/vet.service';
import { PrescriptionService } from '../../../shared/services/prescription.service';
import { CustomerService } from '../../../shared/services/customer.service';

interface PetOption {
  pet: Pet;
  tutorName: string;
}

@Component({
  selector: 'app-admin-consultations',
  templateUrl: './admin-consultations.component.html',
  styleUrls: ['./admin-consultations.component.scss']
})
export class AdminConsultationsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  consultations: Consultation[] = [];
  petOptions: PetOption[] = [];
  activeVets: Vet[] = [];
  statusFilter = '';
  search = '';
  error = '';
  success = '';

  statusLabels: Record<ConsultationStatus, string> = {
    agendado: 'Agendado',
    em_atendimento: 'Em atendimento',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };
  readonly statusOrder: ConsultationStatus[] = ['agendado', 'em_atendimento', 'concluido', 'cancelado'];

  showForm = false;
  saving = false;
  newConsultation = {
    petId: '' as unknown as number,
    vetId: '' as unknown as number,
    scheduledDate: '',
    scheduledTime: '',
    reason: ''
  };

  expandedId: number | null = null;
  editData: {
    vetId?: number | null; scheduledDate?: string; scheduledTime?: string;
    reason?: string; weight?: number | null; temperature?: number | null;
    diagnosis?: string; notes?: string;
  } = {};

  rxItems: PrescriptionItem[] = [];
  rxNotes = '';
  rxSaving = false;
  rxViewEditing = false;
  printRx: { consultation: Consultation; prescription: Prescription } | null = null;

  constructor(
    private consultationService: ConsultationService,
    private vetService: VetService,
    private prescriptionService: PrescriptionService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.consultationService.refresh();
    this.consultationService.getConsultations().pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.consultations = list;
    });
    this.vetService.getVets().pipe(takeUntil(this.destroy$)).subscribe(vets => {
      this.activeVets = vets.filter(v => v.active);
    });
    this.customerService.getCustomers().pipe(takeUntil(this.destroy$)).subscribe(customers => {
      this.petOptions = [];
      for (const c of customers) {
        for (const p of c.pets || []) {
          this.petOptions.push({ pet: p, tutorName: c.name });
        }
      }
    });
  }

  get filtered(): Consultation[] {
    const term = this.search.trim().toLowerCase();
    return this.consultations.filter(c => {
      if (this.statusFilter && c.status !== this.statusFilter) return false;
      if (term && !`${c.petName} ${c.customerName}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }

  create(): void {
    this.error = '';
    if (!this.newConsultation.petId || !this.newConsultation.scheduledDate) {
      this.error = 'Selecione o pet e a data da consulta.';
      return;
    }
    this.saving = true;
    this.consultationService.create({
      petId: Number(this.newConsultation.petId),
      vetId: this.newConsultation.vetId ? Number(this.newConsultation.vetId) : undefined,
      scheduledDate: this.newConsultation.scheduledDate,
      scheduledTime: this.newConsultation.scheduledTime || undefined,
      reason: this.newConsultation.reason || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: created => {
        this.saving = false;
        this.showForm = false;
        this.newConsultation = { petId: '' as unknown as number, vetId: '' as unknown as number, scheduledDate: '', scheduledTime: '', reason: '' };
        this.success = `Consulta de ${created.petName} agendada para ${this.formatDate(created.scheduledDate)}.`;
      },
      error: err => {
        this.saving = false;
        this.error = err.error?.error || 'Erro ao criar consulta.';
      }
    });
  }

  toggleExpand(c: Consultation): void {
    if (this.expandedId === c.id) {
      this.expandedId = null;
      return;
    }
    this.expandedId = c.id;
    if (c.prescriptionId && !this.prescriptionService.getCachedByConsultation(c.id)) {
      this.prescriptionService.getById(c.prescriptionId).pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
    }
    this.editData = {
      vetId: c.vetId ?? null,
      scheduledDate: c.scheduledDate,
      scheduledTime: c.scheduledTime || '',
      reason: c.reason || '',
      weight: c.weight ?? null,
      temperature: c.temperature ?? null,
      diagnosis: c.diagnosis || '',
      notes: c.notes || ''
    };
    this.initRxEditor(c);
  }

  saveClinical(c: Consultation): void {
    this.error = '';
    this.consultationService.update(c.id, {
      vetId: this.editData.vetId || null,
      scheduledDate: this.editData.scheduledDate,
      scheduledTime: this.editData.scheduledTime || undefined,
      reason: this.editData.reason,
      weight: this.editData.weight ?? null,
      temperature: this.editData.temperature ?? null,
      diagnosis: this.editData.diagnosis,
      notes: this.editData.notes
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.success = 'Consulta atualizada.',
      error: err => this.error = err.error?.error || 'Erro ao salvar consulta.'
    });
  }

  setStatus(c: Consultation, status: ConsultationStatus): void {
    this.consultationService.update(c.id, { status }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.success = `Status alterado para ${this.statusLabels[status]}.`,
      error: err => this.error = err.error?.error || 'Erro ao alterar status.'
    });
  }

  prescriptionFor(c: Consultation): Prescription | undefined {
    return this.prescriptionService.getCachedByConsultation(c.id);
  }

  initRxEditor(c: Consultation): void {
    this.rxViewEditing = false;
    const existing = this.prescriptionService.getCachedByConsultation(c.id);
    this.rxItems = existing ? existing.items.map(i => ({ ...i })) : [this.emptyRxItem()];
    this.rxNotes = existing?.notes || '';
  }

  emptyRxItem(): PrescriptionItem {
    return { medication: '', dosage: '', frequency: '', duration: '', instructions: '' };
  }

  addRxItem(): void {
    this.rxItems.push(this.emptyRxItem());
  }

  removeRxItem(index: number): void {
    this.rxItems.splice(index, 1);
  }

  emitPrescription(c: Consultation): void {
    this.error = '';
    const items = this.rxItems.filter(i => i.medication && i.medication.trim());
    if (!items.length) {
      this.error = 'A receita precisa de ao menos um medicamento.';
      return;
    }
    this.rxSaving = true;
    this.prescriptionService.save({
      consultationId: c.id,
      vetId: c.vetId || undefined,
      notes: this.rxNotes || undefined,
      items
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.rxSaving = false;
        this.success = 'Receita emitida.';
      },
      error: err => {
        this.rxSaving = false;
        this.error = err.error?.error || 'Erro ao emitir receita.';
      }
    });
  }

  printPrescription(c: Consultation): void {
    const prescription = this.prescriptionFor(c);
    if (!prescription) return;
    this.printRx = { consultation: c, prescription };
    setTimeout(() => window.print());
  }

  downloadPdf(prescription: Prescription): void {
    this.error = '';
    this.prescriptionService.downloadPdf(prescription.id, `receita-${prescription.petName || prescription.id}.pdf`)
      .pipe(takeUntil(this.destroy$)).subscribe({
        error: () => this.error = 'Não foi possível baixar o PDF.'
      });
  }

  formatDate(date: string): string {
    if (!date) return '—';
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  trackById(_index: number, item: { id?: number }): number | undefined {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByPet(_index: number, opt: PetOption): number | undefined {
    return opt.pet.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
