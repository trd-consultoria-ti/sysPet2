import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { AuthService, User } from '../../shared/services/auth.service';
import { CustomerService } from '../../shared/services/customer.service';
import { OrderService } from '../../shared/services/order.service';
import { AppointmentService } from '../../shared/services/appointment.service';
import { Customer } from '../../shared/models/customer.model';
import { Pet } from '../../shared/models/pet.model';
import { Order, OrderStatus } from '../../shared/models/order.model';
import { Appointment, AppointmentStatus } from '../../shared/models/appointment.model';

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

  petForm: FormGroup;
  showPetForm = false;
  editingPetId: number | null = null;
  savingPet = false;
  petError = '';

  petTypes = ['Cachorro', 'Gato', 'Pássaro', 'Coelho', 'Outro'];

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
    private fb: FormBuilder
  ) {
    this.petForm = this.fb.group({
      name: ['', [Validators.required]],
      type: ['Cachorro', [Validators.required]],
      breed: [''],
      age: [null]
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

    this.orderService.getOrders().pipe(takeUntil(this.destroy$)).subscribe(orders => {
      this.orders = orders
        .filter(o => o.userId === this.user!.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    this.appointmentService.getAppointments().pipe(takeUntil(this.destroy$)).subscribe(appointments => {
      this.appointments = appointments;
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

  startAddPet(): void {
    this.showPetForm = true;
    this.editingPetId = null;
    this.petError = '';
    this.petForm.reset({ name: '', type: 'Cachorro', breed: '', age: null });
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
      age: pet.age ?? null
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
    if (this.editingPetId) {
      return this.customerService.updatePet(customerId, {
        id: this.editingPetId,
        customerId,
        name: value.name!,
        type: value.type!,
        breed: value.breed,
        age: value.age
      });
    }
    return this.customerService.addPet(customerId, {
      name: value.name!,
      type: value.type!,
      breed: value.breed,
      age: value.age
    });
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
