import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DailyService, DailyQueueResponse, DailyServiceStatus } from '../models/daily-service.model';

@Injectable({
  providedIn: 'root'
})
export class DailyServicesService {
  private queueSubject = new BehaviorSubject<DailyQueueResponse>({
    items: [],
    stats: {
      date: new Date().toISOString().split('T')[0],
      capacity: 50,
      totalToday: 0,
      waiting: 0,
      inProgress: 0,
      ready: 0,
      delivered: 0,
      canceled: 0,
      remainingSpots: 50,
      isFull: false
    }
  });

  public queue$ = this.queueSubject.asObservable();
  private readonly url = `${environment.apiUrl}/daily-services`;

  constructor(private http: HttpClient) {
    this.refresh().subscribe({ error: () => {} });
  }

  refresh(date?: string): Observable<DailyQueueResponse> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<DailyQueueResponse>(this.url, { params }).pipe(
      tap(res => this.queueSubject.next(res))
    );
  }

  getQueue(): Observable<DailyQueueResponse> {
    return this.queue$;
  }

  addCheckin(checkinData: Partial<DailyService>): Observable<DailyService> {
    return this.http.post<DailyService>(this.url, checkinData).pipe(
      tap(() => this.refresh().subscribe({ error: () => {} }))
    );
  }

  checkinFromAppointment(appointmentId: number): Observable<DailyService> {
    return this.http.post<DailyService>(`${environment.apiUrl}/appointments/${appointmentId}/checkin`, {}).pipe(
      tap(() => this.refresh().subscribe({ error: () => {} }))
    );
  }

  updateStatus(id: number, status: DailyServiceStatus): Observable<DailyService> {
    return this.http.patch<DailyService>(`${this.url}/${id}/status`, { status }).pipe(
      tap(() => this.refresh().subscribe({ error: () => {} }))
    );
  }

  updateDetails(id: number, data: Partial<DailyService>): Observable<DailyService> {
    return this.http.put<DailyService>(`${this.url}/${id}`, data).pipe(
      tap(() => this.refresh().subscribe({ error: () => {} }))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.refresh().subscribe({ error: () => {} }))
    );
  }
}
