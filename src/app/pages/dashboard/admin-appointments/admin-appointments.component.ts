import { Component, OnInit } from '@angular/core';
import { Appointment, AppointmentStatus } from '../../../shared/models/appointment.model';
import { AppointmentService } from '../../../shared/services/appointment.service';

@Component({
  selector: 'app-admin-appointments',
  templateUrl: './admin-appointments.component.html',
  styleUrls: ['./admin-appointments.component.scss']
})
export class AdminAppointmentsComponent implements OnInit {
  appointments: Appointment[] = [];

  statusLabels: Record<AppointmentStatus, string> = {
    solicitado: 'Solicitado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  constructor(private appointmentService: AppointmentService) { }

  ngOnInit(): void {
    this.appointmentService.getAppointments().subscribe(appointments => {
      this.appointments = [...appointments].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      );
    });
  }

  setStatus(appointment: Appointment, status: AppointmentStatus): void {
    if (appointment.id) {
      this.appointmentService.updateStatus(appointment.id, status).subscribe();
    }
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
}
