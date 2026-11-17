import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
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
import { MedicationService } from '../../../shared/services/medication.service';
import { Medication } from '../../../shared/models/medication.model';
import { CartService } from '../../../shared/services/cart.service';
import { VaccineService } from '../../../shared/services/vaccine.service';
import { PetVaccine, COMMON_VACCINES } from '../../../shared/models/vaccine.model';
import { BusinessProfileService } from '../../../shared/services/business-profile.service';
import { BusinessProfile } from '../../../shared/models/business-profile.model';

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
  availableMedications: Medication[] = [];

  // Pronto Atendimento / Ordem de Chegada (HU-27)
  showWalkInModal = false;
  walkInPetId: number | '' = '';
  walkInVetId: number | '' = '';
  walkInReason = '';
  walkInPriority: 'normal' | 'urgencia' = 'normal';

  // Carteira de Vacinas do Pet (HU-29)
  showVaccineModal = false;
  selectedPetForVaccine: { petId: number; petName: string; customerName?: string; breed?: string } | null = null;
  petVaccines: PetVaccine[] = [];
  commonVaccineList = COMMON_VACCINES;
  newVacName = 'V8 / V10 Polivalente Canina';
  newVacBatch = '';
  newVacManufacturer = '';
  newVacAppliedAt = new Date().toISOString().split('T')[0];
  newVacNextDueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split('T')[0];
  newVacVetName = '';
  newVacVetCrmv = '';
  newVacNotes = '';

  // Dados Oficiais da Empresa (HU-30)
  businessProfile: BusinessProfile | null = null;

  constructor(
    private consultationService: ConsultationService,
    private vetService: VetService,
    private prescriptionService: PrescriptionService,
    private customerService: CustomerService,
    private medicationService: MedicationService,
    private cartService: CartService,
    private vaccineService: VaccineService,
    private businessProfileService: BusinessProfileService,
    private router: Router
  ) {}

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.showWalkInModal) this.closeWalkInModal();
    if (this.showVaccineModal) this.closeVaccineModal();
    if (this.showForm) this.showForm = false;
  }

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
    this.medicationService.list().pipe(takeUntil(this.destroy$)).subscribe(meds => {
      this.availableMedications = meds.filter(m => m.active !== false);
    });
    this.businessProfileService.getProfile().pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.businessProfile = p;
    });
  }

  // --- Pronto Atendimento / Ordem de Chegada (HU-27) ---
  openWalkInModal(): void {
    this.walkInPetId = '';
    this.walkInVetId = this.activeVets.length ? this.activeVets[0].id : '';
    this.walkInReason = '';
    this.walkInPriority = 'normal';
    this.showWalkInModal = true;
  }

  closeWalkInModal(): void {
    this.showWalkInModal = false;
  }

  submitWalkIn(): void {
    if (!this.walkInPetId) {
      alert('Selecione o pet para registrar a chegada presencial.');
      return;
    }

    const opt = this.petOptions.find(o => o.pet.id === Number(this.walkInPetId));
    if (!opt || !opt.pet.id) return;

    const today = new Date().toISOString().split('T')[0];
    const todayWalkIns = this.consultations.filter(c => c.scheduledDate === today && c.isWalkIn);
    const nextQueueNumber = todayWalkIns.length + 1;

    const payload = {
      petId: opt.pet.id as number,
      vetId: this.walkInVetId ? Number(this.walkInVetId) : undefined,
      scheduledDate: today,
      scheduledTime: 'Ordem de Chegada',
      reason: this.walkInReason || 'Consulta Presencial (Pronto Atendimento)',
      isWalkIn: true,
      walkInQueueOrder: nextQueueNumber,
      triagePriority: this.walkInPriority,
      status: 'agendado' as const
    };

    this.consultationService.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (created) => {
        this.success = `Chegada presencial registrada! ${opt.pet.name} está na posição #${nextQueueNumber} da fila médica.`;
        this.closeWalkInModal();
        setTimeout(() => this.success = '', 4000);
      },
      error: err => {
        this.error = err.error?.error || 'Erro ao registrar chegada presencial.';
      }
    });
  }

  // --- Carteira de Vacinas do Pet (HU-29) ---
  openVaccineModal(c?: Consultation): void {
    const targetPetId = c ? c.petId : (this.current ? this.current.petId : (this.petOptions.length ? this.petOptions[0].pet.id : null));
    const targetPetName = c ? c.petName : (this.current ? this.current.petName : (this.petOptions.length ? this.petOptions[0].pet.name : ''));
    const targetTutor = c ? c.customerName : (this.current ? this.current.customerName : (this.petOptions.length ? this.petOptions[0].tutorName : ''));

    if (!targetPetName) {
      alert('Selecione uma consulta ou pet para abrir a carteira de vacinas.');
      return;
    }

    this.selectedPetForVaccine = {
      petId: targetPetId || 1,
      petName: targetPetName,
      customerName: targetTutor,
      breed: c?.petBreed || this.current?.petBreed
    };

    this.loadPetVaccines(targetPetName, targetPetId || undefined);

    const vet = this.activeVets.length ? this.activeVets[0] : null;
    this.newVacName = 'V8 / V10 Polivalente Canina';
    this.newVacBatch = 'LOTE-' + Math.floor(1000 + Math.random() * 9000);
    this.newVacManufacturer = 'Zoetis';
    this.newVacAppliedAt = new Date().toISOString().split('T')[0];
    this.newVacNextDueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split('T')[0];
    this.newVacVetName = c?.vetName || this.current?.vetName || vet?.name || 'Dr(a). Veterinário(a)';
    this.newVacVetCrmv = c?.vetCrmv || vet?.crmv || 'CRMV-DF';
    this.newVacNotes = '';

    this.showVaccineModal = true;
  }

  loadPetVaccines(petName: string, petId?: number): void {
    this.petVaccines = this.vaccineService.getVaccinesForPet(petName, petId);
  }

  closeVaccineModal(): void {
    this.showVaccineModal = false;
    this.selectedPetForVaccine = null;
  }

  saveVaccine(): void {
    if (!this.selectedPetForVaccine) return;

    this.vaccineService.addVaccine({
      petId: this.selectedPetForVaccine.petId,
      petName: this.selectedPetForVaccine.petName,
      customerName: this.selectedPetForVaccine.customerName,
      vaccineName: this.newVacName,
      appliedAt: this.newVacAppliedAt,
      nextDueAt: this.newVacNextDueAt,
      batch: this.newVacBatch,
      manufacturer: this.newVacManufacturer,
      vetName: this.newVacVetName,
      vetCrmv: this.newVacVetCrmv,
      consultationId: this.current ? this.current.id : undefined,
      notes: this.newVacNotes
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadPetVaccines(this.selectedPetForVaccine!.petName, this.selectedPetForVaccine!.petId);
      this.success = `Vacina "${this.newVacName}" registrada na carteira de ${this.selectedPetForVaccine!.petName}!`;
      setTimeout(() => this.success = '', 3500);
    });
  }

  printVaccineCard(): void {
    window.print();
  }

  get totalConsultations(): number {
    return this.consultations.length;
  }

  get scheduledCount(): number {
    return this.consultations.filter(c => c.status === 'agendado').length;
  }

  get inProgressCount(): number {
    return this.consultations.filter(c => c.status === 'em_atendimento').length;
  }

  get completedCount(): number {
    return this.consultations.filter(c => c.status === 'concluido').length;
  }

  getInitials(name: string): string {
    if (!name) return 'PT';
    return name.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  addConsultationToCart(c: Consultation): void {
    // 1. Adiciona a Consulta Veterinária
    this.cartService.addCustomItem({
      id: 7000 + c.id,
      name: `Consulta Veterinária — Pet ${c.petName} (Dr(a). ${c.vetName || 'Clínico'})`,
      price: 150.00,
      image: 'assets/images/logo.png',
      quantity: 1
    });

    // 2. Se houver receita emitida ou itens no rxItems da sessão atual, adiciona ao carrinho
    const rx = this.prescriptionFor(c);
    const itemsToAdd = rx?.items && rx.items.length > 0 
      ? rx.items 
      : this.rxItems.filter(i => i.medication && i.medication.trim());

    if (itemsToAdd && itemsToAdd.length > 0) {
      itemsToAdd.forEach((item, idx) => {
        if (!item.medication || !item.medication.trim()) return;
        const found = this.availableMedications.find(
          m => m.name.toLowerCase() === item.medication.trim().toLowerCase()
        );
        const medPrice = found?.price || 45.00;
        const medId = found ? 8000 + found.id : 8500 + c.id * 10 + idx;

        this.cartService.addCustomItem({
          id: medId,
          name: `Medicamento: ${item.medication}${item.dosage ? ' (' + item.dosage + ')' : ''}`,
          price: medPrice,
          image: 'assets/images/logo.png',
          quantity: 1
        });
      });
    }

    this.success = `Consulta e prescrições de ${c.petName} adicionadas ao Carrinho!`;
    this.router.navigate(['/cart']);
  }

  emitPrescriptionAndGoToCart(): void {
    if (!this.current) return;
    this.error = '';
    const items = this.rxItems.filter(i => i.medication && i.medication.trim());
    if (!items.length) {
      this.addConsultationToCart(this.current);
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
        this.addConsultationToCart(this.current!);
      },
      error: err => {
        this.rxSaving = false;
        this.error = err.error?.error || 'Erro ao emitir receita.';
      }
    });
  }

  skipPrescriptionAndGoToCart(): void {
    if (!this.current) return;
    this.addConsultationToCart(this.current);
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
      weight: this.editData.weight == null ? null : Math.round(this.editData.weight * 100) / 100,
      temperature: this.editData.temperature == null ? null : Math.round(this.editData.temperature * 10) / 10,
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

  onMedicationSelect(item: PrescriptionItem): void {
    if (!item.medication) return;
    const found = this.availableMedications.find(
      m => m.name.toLowerCase() === item.medication.trim().toLowerCase()
    );
    if (found) {
      if (!item.dosage && found.concentration) item.dosage = found.concentration;
      if (!item.instructions && found.defaultDosage) item.instructions = found.defaultDosage;
    }
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
