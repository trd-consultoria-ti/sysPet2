import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { AuthService, User } from '../../shared/services/auth.service';
import { CustomerService } from '../../shared/services/customer.service';
import { OrderService } from '../../shared/services/order.service';
import { AppointmentService } from '../../shared/services/appointment.service';
import { Customer } from '../../shared/models/customer.model';
import { Pet, getPetSizeTier, getPetSizeLabel } from '../../shared/models/pet.model';
import { Order, OrderStatus } from '../../shared/models/order.model';
import { Appointment, AppointmentStatus } from '../../shared/models/appointment.model';
import { Consultation, ConsultationStatus } from '../../shared/models/consultation.model';
import { Prescription } from '../../shared/models/prescription.model';
import { ConsultationService } from '../../shared/services/consultation.service';
import { PrescriptionService } from '../../shared/services/prescription.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  user: User | null = null;
  customer: Customer | null = null;
  orders: Order[] = [];
  appointments: Appointment[] = [];
  consultations: Consultation[] = [];
  viewingPrescription: Prescription | null = null;
  printRx: Prescription | null = null;

  petForm: FormGroup;
  showPetForm = false;
  editingPetId: number | null = null;
  savingPet = false;
  petError = '';

  petTypes = ['Cachorro', 'Gato', 'Pássaro', 'Coelho', 'Outro'];

  exportLoading = false;
  privacyError = '';
  privacyMessage = '';
  confirmingDelete = false;
  deletePassword = '';
  deletingAccount = false;

  orderStatusLabels: Record<OrderStatus, string> = {
    pendente: 'Pendente',
    pago: 'Pago',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  appointmentStatusLabels: Record<AppointmentStatus, string> = {
    solicitado: 'Solicitado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  consultationStatusLabels: Record<ConsultationStatus, string> = {
    agendado: 'Agendado',
    em_atendimento: 'Em atendimento',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  roleLabels: Record<User['role'], string> = {
    admin: 'Administrador',
    collaborator: 'Colaborador',
    customer: 'Cliente'
  };

  constructor(
    private authService: AuthService,
    private customerService: CustomerService,
    private orderService: OrderService,
    private appointmentService: AppointmentService,
    private consultationService: ConsultationService,
    private prescriptionService: PrescriptionService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.petForm = this.fb.group({
      name: ['', [Validators.required]],
      type: ['Cachorro', [Validators.required]],
      breed: [''],
      age: [null],
      weightKg: [null, [Validators.min(0.1)]]
    });
  }

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    if (!this.user) {
      return;
    }

    this.customerService.getCustomers().pipe(takeUntil(this.destroy$)).subscribe(customers => {
      this.customer = customers.find(c => c.userId === this.user!.id) || null;
    });

    this.orderService.refresh();
    this.appointmentService.refresh();
    this.orderService.getOrders().pipe(takeUntil(this.destroy$)).subscribe(orders => {
      this.orders = orders
        .filter(o => o.userId === this.user!.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    this.appointmentService.getAppointments().pipe(takeUntil(this.destroy$)).subscribe(appointments => {
      this.appointments = appointments;
    });

    this.consultationService.refresh();
    this.consultationService.getConsultations().pipe(takeUntil(this.destroy$)).subscribe(consultations => {
      this.consultations = consultations;
    });
  }

  get pets(): Pet[] {
    return this.customer?.pets || [];
  }

  get myAppointments(): Appointment[] {
    if (!this.customer?.id) {
      return [];
    }
    return this.appointments
      .filter(a => a.customerId === this.customer!.id)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }

  prescriptionFor(c: Consultation): Prescription | undefined {
    return this.prescriptionService.getCachedByConsultation(c.id);
  }

  viewPrescription(c: Consultation): void {
    const cached = this.prescriptionService.getCachedByConsultation(c.id);
    if (cached) {
      this.viewingPrescription = cached;
      return;
    }
    if (c.prescriptionId) {
      this.prescriptionService.getById(c.prescriptionId).pipe(takeUntil(this.destroy$)).subscribe({
        next: rx => this.viewingPrescription = rx,
        error: () => {}
      });
    }
  }

  printPrescription(rx: Prescription): void {
    this.printRx = rx;
    setTimeout(() => window.print());
  }

  downloadPrescriptionPdf(rx: Prescription): void {
    this.prescriptionService.downloadPdf(rx.id, `receita-${rx.petName || rx.id}.pdf`)
      .pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
  }

  trackById(_index: number, item: { id?: number }): number | undefined {
    return item.id;
  }

  startAddPet(): void {
    this.showPetForm = true;
    this.editingPetId = null;
    this.petError = '';
    this.petForm.reset({ name: '', type: 'Cachorro', breed: '', age: null, weightKg: null });
  }

  startEditPet(pet: Pet): void {
    if (!pet.id) {
      return;
    }
    this.showPetForm = true;
    this.editingPetId = pet.id;
    this.petError = '';
    this.petForm.patchValue({
      name: pet.name,
      type: pet.type,
      breed: pet.breed || '',
      age: pet.age ?? null,
      weightKg: pet.weightKg ?? null
    });
  }

  cancelPetForm(): void {
    this.showPetForm = false;
    this.editingPetId = null;
    this.petError = '';
  }

  savePet(): void {
    if (this.petForm.invalid || !this.user) {
      return;
    }
    this.savingPet = true;
    this.petError = '';
    const value = this.petForm.value;

    const request$: Observable<Pet | Customer> = this.customer?.id
      ? this.savePetForCustomer(this.customer.id, value)
      : this.customerService.addCustomer({
          userId: this.user.id,
          name: this.user.name,
          email: this.user.email,
          phone: '',
          status: 'active'
        }).pipe(
          switchMap(created => this.savePetForCustomer(created.id!, value))
        );

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.savingPet = false;
        this.showPetForm = false;
        this.editingPetId = null;
      },
      error: () => {
        this.savingPet = false;
        this.petError = 'Não foi possível salvar o pet. Tente novamente.';
      }
    });
  }

  private savePetForCustomer(customerId: number, value: Partial<Pet>): Observable<Pet> {
    const weightVal = value.weightKg ? Number(value.weightKg) : undefined;
    if (this.editingPetId) {
      return this.customerService.updatePet(customerId, {
        id: this.editingPetId,
        customerId,
        name: value.name!,
        type: value.type!,
        breed: value.breed,
        age: value.age,
        weightKg: weightVal
      });
    }
    return this.customerService.addPet(customerId, {
      name: value.name!,
      type: value.type!,
      breed: value.breed,
      age: value.age,
      weightKg: weightVal
    });
  }

  getPetSizeInfo(weightKg?: number | null): string {
    if (!weightKg) return '';
    const tier = getPetSizeTier(weightKg);
    return getPetSizeLabel(tier);
  }

  deletePet(pet: Pet): void {
    if (!this.customer?.id || !pet.id) {
      return;
    }
    if (!confirm(`Excluir o pet ${pet.name}?`)) {
      return;
    }
    this.customerService.deletePet(this.customer.id, pet.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  exportData(): void {
    this.privacyError = '';
    this.privacyMessage = '';
    this.exportLoading = true;
    this.authService.exportMyData().pipe(takeUntil(this.destroy$)).subscribe({
      next: blob => {
        this.exportLoading = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meus-dados-animal-world.json';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.exportLoading = false;
        this.privacyError = 'Exportação ainda não disponível no servidor.';
      }
    });
  }

  startDeleteAccount(): void {
    this.privacyError = '';
    this.confirmingDelete = true;
    this.deletePassword = '';
  }

  cancelDeleteAccount(): void {
    this.confirmingDelete = false;
    this.deletePassword = '';
  }

  confirmDeleteAccount(): void {
    if (!this.deletePassword || this.deletingAccount) return;
    this.deletingAccount = true;
    this.privacyError = '';
    this.authService.deleteMyAccount(this.deletePassword).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.authService.logout();
        this.router.navigate(['/']);
      },
      error: err => {
        this.deletingAccount = false;
        this.privacyError = err?.error?.error || 'Não foi possível excluir a conta. Tente novamente.';
      }
    });
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
