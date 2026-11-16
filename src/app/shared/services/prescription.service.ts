import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Prescription, PrescriptionItem } from '../models/prescription.model';

@Injectable({
  providedIn: 'root'
})
export class PrescriptionService {
  private readonly url = `${environment.apiUrl}/prescriptions`;
  // mapa em memória consultationId -> receita emitida nesta sessão;
  // a API não expõe listagem nem prescriptionId na consulta
  private byConsultation = new Map<number, Prescription>();

  constructor(private http: HttpClient) {}

  getCachedByConsultation(consultationId: number): Prescription | undefined {
    return this.byConsultation.get(consultationId);
  }

  save(data: {
    consultationId: number;
    vetId?: number;
    notes?: string;
    items: PrescriptionItem[];
  }): Observable<Prescription> {
    return this.http.post<Prescription>(this.url, data).pipe(
      tap(saved => this.byConsultation.set(saved.consultationId, saved))
    );
  }

  getById(id: number): Observable<Prescription> {
    return this.http.get<Prescription>(`${this.url}/${id}`).pipe(
      tap(p => this.byConsultation.set(p.consultationId, p))
    );
  }

  downloadPdf(id: number, filename = `receita-${id}.pdf`): Observable<string> {
    return this.http.get(`${this.url}/${id}/pdf`, { responseType: 'blob' }).pipe(
      map(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return url;
      })
    );
  }
}
