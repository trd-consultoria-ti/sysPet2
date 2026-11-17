import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Consultation } from '../models/consultation.model';

@Injectable({
  providedIn: 'root'
})
export class ConsultationService {
  private consultationsSubject = new BehaviorSubject<Consultation[]>([]);
  public consultations$ = this.consultationsSubject.asObservable();
  private readonly url = `${environment.apiUrl}/consultations`;

  constructor(private http: HttpClient) {
    this.refresh();
  }

  refresh(): void {
    this.http.get<Consultation[]>(this.url).subscribe({
      next: consultations => this.consultationsSubject.next(consultations),
      error: err => console.error('Falha ao carregar consultas', err)
    });
  }

  getConsultations(): Observable<Consultation[]> {
    return this.consultations$;
  }

  getById(id: number): Observable<Consultation> {
    return this.http.get<Consultation>(`${this.url}/${id}`);
  }

  create(data: {
    petId: number;
    vetId?: number;
    scheduledDate: string;
    scheduledTime?: string;
    reason?: string;
    isWalkIn?: boolean;
    walkInQueueOrder?: number;
    triagePriority?: 'normal' | 'urgencia';
    status?: Consultation['status'];
  }): Observable<Consultation> {
    return this.http.post<Consultation>(this.url, data).pipe(
      tap(created => this.consultationsSubject.next([created, ...this.consultationsSubject.value]))
    );
  }

  update(id: number, data: Partial<Consultation>): Observable<Consultation> {
    return this.http.patch<Consultation>(`${this.url}/${id}`, data).pipe(
      tap(updated => {
        const list = this.consultationsSubject.value.map(c => c.id === updated.id ? updated : c);
        this.consultationsSubject.next(list);
      })
    );
  }
}
