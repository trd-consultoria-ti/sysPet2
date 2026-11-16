import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditEntry {
  id: number;
  entity: string;
  entityId: number;
  action: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  userName?: string;
  userEmail?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private readonly url = `${environment.apiUrl}/audit`;

  constructor(private http: HttpClient) { }

  list(entity: string, entityId: number): Observable<AuditEntry[]> {
    const params = new HttpParams()
      .set('entity', entity)
      .set('entityId', String(entityId));
    return this.http.get<AuditEntry[]>(this.url, { params });
  }
}
