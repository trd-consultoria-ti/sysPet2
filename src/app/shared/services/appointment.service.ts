import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Appointment, AppointmentStatus } from '../models/appointment.model';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private appointmentsSubject = new BehaviorSubject<Appointment[]>([]);
  public appointments$ = this.appointmentsSubject.asObservable();
  private readonly url = `${environment.apiUrl}/appointments`;

  constructor(private http: HttpClient) {
    this.refresh();
  }

  refresh(): void {
    this.http.get<Appointment[]>(this.url).subscribe({
      next: appointments => this.appointmentsSubject.next(appointments),
      error: err => console.error('Falha ao carregar agendamentos', err)
    });
  }

  getAppointments(): Observable<Appointment[]> {
    return this.appointments$;
  }

  add(appointment: Omit<Appointment, 'id' | 'status' | 'createdAt'>): Observable<Appointment> {
    return this.http.post<Appointment>(this.url, appointment).pipe(
      tap(created => this.appointmentsSubject.next([...this.appointmentsSubject.value, created]))
    );
  }

  updateStatus(id: number, status: AppointmentStatus): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.url}/${id}/status`, { status }).pipe(
      tap(updated => {
        const list = this.appointmentsSubject.value.map(a => a.id === updated.id ? updated : a);
        this.appointmentsSubject.next(list);
      })
    );
  }

  cancel(id: number): void {
    this.updateStatus(id, 'cancelado').subscribe();
  }

  getById(id: number): Appointment | undefined {
    return this.appointmentsSubject.value.find(a => a.id === id);
  }
}
