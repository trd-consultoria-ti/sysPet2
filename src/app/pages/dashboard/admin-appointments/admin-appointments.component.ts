import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Appointment, AppointmentStatus } from '../../../shared/models/appointment.model';
import { AppointmentService } from '../../../shared/services/appointment.service';
import { DailyServicesService } from '../../../shared/services/daily-services.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface WeekDay {
  date: string;
  label: string;
  isToday: boolean;
  appointments: Appointment[];
}

@Component({
  selector: 'app-admin-appointments',
  templateUrl: './admin-appointments.component.html',
  styleUrls: ['./admin-appointments.component.scss']
})
export class AdminAppointmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  appointments: Appointment[] = [];
  viewMode: 'list' | 'week' = 'list';
  weekOffset = 0;
  printAppointment: Appointment | null = null;

  statusLabels: Record<AppointmentStatus, string> = {
    solicitado: 'Solicitado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  constructor(
    private appointmentService: AppointmentService,
    private dailyServicesService: DailyServicesService,
    private router: Router
  ) { }

  checkinToDailyQueue(appointment: Appointment): void {
    if (!appointment.id) return;
    this.dailyServicesService.checkinFromAppointment(appointment.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (ds) => {
        alert(`Check-in de ${appointment.petName} realizado com sucesso na Fila do Dia! Posição: #${ds.queueOrder}`);
        this.router.navigate(['/dashboard/daily-queue']);
      },
      error: (err) => {
        const msg = err?.error?.error || 'Erro ao realizar check-in';
        alert(msg);
      }
    });
  }

  trackById(index: number, item: { id?: number }): number {
    return item.id ?? index;
  }

  trackByIndex(index: number): number {
    return index;
  }

  ngOnInit(): void {
    this.appointmentService.getAppointments().pipe(takeUntil(this.destroy$)).subscribe(appointments => {
      this.appointments = [...appointments].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      );
    });
  }

  setStatus(appointment: Appointment, status: AppointmentStatus): void {
    if (appointment.id) {
      this.appointmentService.updateStatus(appointment.id, status).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  get weekDays(): WeekDay[] {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const dayOfWeek = (base.getDay() + 6) % 7; // segunda = 0
    const monday = new Date(base);
    monday.setDate(base.getDate() - dayOfWeek + this.weekOffset * 7);

    const todayIso = this.toIso(base);
    const names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = this.toIso(d);
      return {
        date: iso,
        label: `${names[i]} ${this.formatDate(iso)}`,
        isToday: iso === todayIso,
        appointments: this.appointments.filter(a => a.date === iso)
      };
    });
  }

  prevWeek(): void { this.weekOffset--; }
  nextWeek(): void { this.weekOffset++; }
  currentWeek(): void { this.weekOffset = 0; }

  printSlip(appointment: Appointment): void {
    this.printAppointment = appointment;
    setTimeout(() => window.print());
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  private toIso(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
