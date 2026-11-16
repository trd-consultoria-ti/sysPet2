import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Service } from '../models/service.model';

@Injectable({
  providedIn: 'root'
})
export class ServiceCatalogService {
  private servicesSubject = new BehaviorSubject<Service[]>([]);
  public services$ = this.servicesSubject.asObservable();
  private readonly url = `${environment.apiUrl}/services`;

  constructor(private http: HttpClient) {
    this.http.get<Service[]>(this.url).subscribe({
      next: services => this.servicesSubject.next(services),
      error: err => console.error('Falha ao carregar serviços', err)
    });
  }

  getServices(): Observable<Service[]> {
    return this.services$;
  }

  getById(id: number): Service | undefined {
    return this.servicesSubject.value.find(s => s.id === id);
  }

  create(service: Omit<Service, 'id'>): Observable<Service> {
    return this.http.post<Service>(this.url, service).pipe(
      tap(created => this.servicesSubject.next([...this.servicesSubject.value, created]))
    );
  }

  update(service: Service): Observable<Service> {
    return this.http.put<Service>(`${this.url}/${service.id}`, service).pipe(
      tap(updated => {
        const list = this.servicesSubject.value.map(s => s.id === updated.id ? updated : s);
        this.servicesSubject.next(list);
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.servicesSubject.next(this.servicesSubject.value.filter(s => s.id !== id)))
    );
  }
}
