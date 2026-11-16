import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Medication } from '../models/medication.model';

@Injectable({
  providedIn: 'root'
})
export class MedicationService {
  private readonly apiUrl = `${environment.apiUrl}/medications`;

  constructor(private http: HttpClient) {}

  list(): Observable<Medication[]> {
    return this.http.get<Medication[]>(this.apiUrl);
  }

  get(id: number): Observable<Medication> {
    return this.http.get<Medication>(`${this.apiUrl}/${id}`);
  }

  create(medication: Partial<Medication>): Observable<Medication> {
    return this.http.post<Medication>(this.apiUrl, medication);
  }

  update(id: number, medication: Partial<Medication>): Observable<Medication> {
    return this.http.put<Medication>(`${this.apiUrl}/${id}`, medication);
  }

  delete(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`);
  }
}
