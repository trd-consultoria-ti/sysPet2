import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Vet } from '../models/vet.model';

@Injectable({
  providedIn: 'root'
})
export class VetService {
  private vetsSubject = new BehaviorSubject<Vet[]>([]);
  public vets$ = this.vetsSubject.asObservable();
  private readonly url = `${environment.apiUrl}/vets`;

  constructor(private http: HttpClient) {
    this.refresh();
  }

  refresh(): void {
    this.http.get<Vet[]>(this.url).subscribe({
      next: vets => this.vetsSubject.next(vets),
      error: err => console.error('Falha ao carregar veterinários', err)
    });
  }

  getVets(): Observable<Vet[]> {
    return this.vets$;
  }

  create(data: Omit<Vet, 'id' | 'createdAt'>): Observable<Vet> {
    return this.http.post<Vet>(this.url, data).pipe(
      tap(created => this.vetsSubject.next([created, ...this.vetsSubject.value]))
    );
  }

  update(id: number, data: Partial<Vet>): Observable<Vet> {
    return this.http.put<Vet>(`${this.url}/${id}`, data).pipe(
      tap(updated => {
        const list = this.vetsSubject.value.map(v => v.id === updated.id ? updated : v);
        this.vetsSubject.next(list);
      })
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.vetsSubject.next(this.vetsSubject.value.filter(v => v.id !== id)))
    );
  }
}
