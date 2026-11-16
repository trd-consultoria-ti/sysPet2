import { Component, OnInit, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Service } from '../../shared/models/service.model';
import { Customer } from '../../shared/models/customer.model';
import { Pet } from '../../shared/models/pet.model';
import { Appointment, AppointmentStatus } from '../../shared/models/appointment.model';
import { AppointmentService } from '../../shared/services/appointment.service';
import { ServiceCatalogService } from '../../shared/services/service-catalog.service';
import { CustomerService } from '../../shared/services/customer.service';
import { AuthService } from '../../shared/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-appointments',
  templateUrl: './appointments.component.html',
  styleUrls: ['./appointments.component.scss']
})
export class AppointmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  appointmentForm: FormGroup;
  services: Service[] = [];
  customers: Customer[] = [];
  appointments: Appointment[] = [];
  confirmationMessage: string = '';
  isCustomerRole = false;
  currentUser: any = null;
  myCustomerId: number | null = null;
  private allAppointments: Appointment[] = [];
  showPetForm = false;
  petForm: FormGroup;

  statusLabels: Record<AppointmentStatus, string> = {
    solicitado: 'Solicitado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private appointmentService: AppointmentService,
    private serviceCatalog: ServiceCatalogService,
    private customerService: CustomerService,
    private authService: AuthService
  ) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    this.minDate = minDate;

    this.appointmentForm = this.fb.group({
      customerId: [null, [Validators.required]],
      petId: [null, [Validators.required]],
      serviceId: [null, [Validators.required]],
      date: ['', [Validators.required, this.futureDateValidator.bind(this)]],
      time: ['', [Validators.required]],
      notes: ['']
    });

    this.petForm = this.fb.group({
      name: ['', [Validators.required]],
      type: ['Cachorro', [Validators.required]],
      breed: [''],
      age: [null]
    });

    this.appointmentForm.get('customerId')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.appointmentForm.patchValue({ petId: null }, { emitEvent: false });
    });
  }

  minDate: string = '';

  private futureDateValidator(control: AbstractControl) {
    if (!control.value) {
      return null;
    }
    return control.value < this.minDate ? { pastDate: true } : null;
  }

  ngOnInit(): void {
    this.serviceCatalog.getServices().pipe(takeUntil(this.destroy$)).subscribe(services => {
      this.services = [...services];
    });

    const user = this.authService.getCurrentUser();
    this.currentUser = user;
    this.isCustomerRole = user?.role === 'customer';

    this.customerService.getCustomers().pipe(takeUntil(this.destroy$)).subscribe(customers => {
      this.customers = [...customers];
      if (user) {
        const mine = customers.find(c => c.userId === user.id || c.email === user.email);
        if (mine?.id) {
          this.myCustomerId = mine.id;
          if (!this.appointmentForm.get('customerId')?.value) {
            this.appointmentForm.patchValue({ customerId: mine.id });
          }
          if (this.isCustomerRole) {
            this.appointmentForm.get('customerId')!.disable();
          }
        }
      }
      this.applyAppointmentFilter();
    });

    this.appointmentService.refresh();
    this.appointmentService.getAppointments().pipe(takeUntil(this.destroy$)).subscribe(appointments => {
      this.allAppointments = [...appointments];
      this.applyAppointmentFilter();
    });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const serviceId = params.get('serviceId');
      if (serviceId) {
        this.appointmentForm.patchValue({ serviceId: +serviceId });
      }
    });
  }

  savePet(): void {
    const targetCustomerId = this.myCustomerId || this.appointmentForm.get('customerId')?.value;
    if (this.petForm.valid && targetCustomerId) {
      const v = this.petForm.value;
      this.customerService.addPet(targetCustomerId, {
        name: v.name,
        type: v.type,
        breed: v.breed || undefined,
        age: v.age || undefined
      }).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.customerService.refresh();
        this.petForm.reset({ type: 'Cachorro' });
        this.showPetForm = false;
      });
    }
  }

  private applyAppointmentFilter(): void {
    const user = this.authService.getCurrentUser();
    const visible = user
      ? this.allAppointments.filter(a => a.userId === user.id || (this.myCustomerId && a.customerId === this.myCustomerId))
      : this.allAppointments;
    this.appointments = [...visible].sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time)
    );
  }

  get petsOfSelectedCustomer(): Pet[] {
    const customerId = this.appointmentForm.get('customerId')?.value || this.myCustomerId;
    const customer = this.customers.find(c => c.id === customerId);
    return customer?.pets || [];
  }

  onSubmit(): void {
    if (this.appointmentForm.valid) {
      const formValues = this.appointmentForm.value;
      const effectiveCustomerId = formValues.customerId ?? this.myCustomerId;
      const service = this.services.find(s => s.id === +formValues.serviceId);
      const customer = this.customers.find(c => c.id === +effectiveCustomerId);
      const pet = (customer?.pets || []).find(p => p.id === +formValues.petId);

      if (!service || !customer || !pet) {
        this.confirmationMessage = '';
        return;
      }

      this.appointmentService.add({
        userId: this.currentUser?.id,
        petName: pet?.name || '',
        serviceId: service?.id,
        serviceName: service?.name,
        customerName: customer?.name,
        customerId: customer?.id,
        date: formValues.date,
        time: formValues.time,
        notes: formValues.notes || undefined
      }).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.confirmationMessage = `Agendamento solicitado para ${pet?.name} em ${this.formatDate(formValues.date)} às ${formValues.time}.`;
        this.appointmentService.refresh();
        this.appointmentForm.reset({ customerId: this.myCustomerId });
      });
    }
  }

  cancelAppointment(appointment: Appointment): void {
    if (appointment.id) {
      this.appointmentService.cancel(appointment.id);
    }
  }

  canCancel(appointment: Appointment): boolean {
    return appointment.status === 'solicitado' || appointment.status === 'confirmado';
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
