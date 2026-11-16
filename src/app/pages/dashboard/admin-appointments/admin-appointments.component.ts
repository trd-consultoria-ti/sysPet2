import { Component, OnInit, OnDestroy } from '@angular/core';
import { Appointment, AppointmentStatus } from '../../../shared/models/appointment.model';
import { AppointmentService } from '../../../shared/services/appointment.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-appointments',
  templateUrl: './admin-appointments.component.html',
  styleUrls: ['./admin-appointments.component.scss']
})
export class AdminAppointmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  appointments: Appointment[] = [];

  statusLabels: Record<AppointmentStatus, string> = {
    solicitado: 'Solicitado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  constructor(private appointmentService: AppointmentService) { }

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

  formatDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
