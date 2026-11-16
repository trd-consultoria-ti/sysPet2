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

interface Step {
  num: number;
  label: string;
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
  error = '';
  success = '';

  readonly steps: Step[] = [
    { num: 1, label: 'Fila do dia' },
    { num: 2, label: 'Atendimento' },
    { num: 3, label: 'Conduta' },
    { num: 4, label: 'Receita' },
    { num: 5, label: 'Finalização' }
  ];
  step = 1;
  current: Consultation | null = null;

  queueDate = new Date().toISOString().split('T')[0];
  showAllDates = false;
  statusFilter = '';
  search = '';

  statusLabels: Record<ConsultationStatus, string> = {
    agendado: 'Agendado',
    em_atendimento: 'Em atendimento',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  showForm = false;
  saving = false;
  newConsultation = {
    petId: '' as unknown as number,
    vetId: '' as unknown as number,
    scheduledDate: '',
    scheduledTime: '',
    reason: ''
  };

  editData: {
    vetId?: number | null; scheduledDate?: string; scheduledTime?: string;
    reason?: string; weight?: number | null; temperature?: number | null;
    diagnosis?: string; notes?: string;
  } = {};

  rxItems: PrescriptionItem[] = [];
  rxNotes = '';
  rxSaving = false;
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
      if (this.current) {
        const fresh = list.find(c => c.id === this.current!.id);
        if (fresh) this.current = fresh;
      }
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

  get queue(): Consultation[] {
    const term = this.search.trim().toLowerCase();
    return this.consultations
      .filter(c => {
        if (!this.showAllDates && c.scheduledDate !== this.queueDate) return false;
        if (this.statusFilter && c.status !== this.statusFilter) return false;
        if (term && !`${c.petName} ${c.customerName}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => {
        const open = (s: ConsultationStatus) => (s === 'em_atendimento' ? 0 : s === 'agendado' ? 1 : 2);
        const diff = open(a.status) - open(b.status);
        if (diff !== 0) return diff;
        return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
      });
  }

  goToStep(n: number): void {
    if (n === 1) {
      this.step = 1;
      return;
    }
    if (!this.current || n > this.step) return;
    this.step = n;
  }

  select(c: Consultation): void {
    this.current = c;
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
    if (c.prescriptionId && !this.prescriptionService.getCachedByConsultation(c.id)) {
      this.prescriptionService.getById(c.prescriptionId).pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
    }
    this.error = '';
    this.step = c.status === 'concluido' ? 4 : 2;
  }

  backToQueue(): void {
    this.step = 1;
    this.current = null;
    this.error = '';
    this.consultationService.refresh();
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
        this.success = `Consulta de ${created.petName} agendada.`;
        this.select(created);
      },
      error: err => {
        this.saving = false;
        this.error = err.error?.error || 'Erro ao criar consulta.';
      }
    });
  }

  startAttendance(): void {
    if (!this.current) return;
    this.error = '';
    const status = this.current.status === 'agendado' ? 'em_atendimento' : this.current.status;
    this.consultationService.update(this.current.id, {
      status,
      vetId: this.editData.vetId || null,
      scheduledTime: this.editData.scheduledTime || undefined,
      reason: this.editData.reason,
      weight: this.editData.weight ?? null,
      temperature: this.editData.temperature ?? null,
      notes: this.editData.notes
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.step = 3; },
      error: err => this.error = err.error?.error || 'Erro ao salvar atendimento.'
    });
  }

  conclude(): void {
    if (!this.current) return;
    this.error = '';
    this.consultationService.update(this.current.id, {
      status: 'concluido',
      diagnosis: this.editData.diagnosis,
      notes: this.editData.notes
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.step = 4; this.initRxEditor(this.current!); },
      error: err => this.error = err.error?.error || 'Erro ao concluir consulta.'
    });
  }

  cancelConsultation(): void {
    if (!this.current) return;
    if (!confirm(`Cancelar a consulta de ${this.current.petName}?`)) return;
    this.consultationService.update(this.current.id, { status: 'cancelado' }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.success = 'Consulta cancelada.'; this.backToQueue(); },
      error: err => this.error = err.error?.error || 'Erro ao cancelar consulta.'
    });
  }

  prescriptionFor(c: Consultation): Prescription | undefined {
    return this.prescriptionService.getCachedByConsultation(c.id);
  }

  initRxEditor(c: Consultation): void {
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

  emitPrescription(): void {
    if (!this.current) return;
    this.error = '';
    const items = this.rxItems.filter(i => i.medication && i.medication.trim());
    if (!items.length) {
      this.error = 'A receita precisa de ao menos um medicamento.';
      return;
    }
    this.rxSaving = true;
    this.prescriptionService.save({
      consultationId: this.current.id,
      vetId: this.current.vetId || undefined,
      notes: this.rxNotes || undefined,
      items
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.rxSaving = false;
        this.step = 5;
      },
      error: err => {
        this.rxSaving = false;
        this.error = err.error?.error || 'Erro ao emitir receita.';
      }
    });
  }

  printPrescription(): void {
    if (!this.current) return;
    const prescription = this.prescriptionFor(this.current);
    if (!prescription) return;
    this.printRx = { consultation: this.current, prescription };
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

  trackByStep(_index: number, s: Step): number {
    return s.num;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
