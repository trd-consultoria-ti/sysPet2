import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RevenueByPaymentMethod {
  payment_method: string | null;
  orders_count: number;
  revenue: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export interface Report {
  from: string;
  to: string;
  ordersCount: number;
  revenue: number;
  byPaymentMethod: RevenueByPaymentMethod[];
  ordersByStatus: StatusCount[];
  topProducts: TopProduct[];
  appointmentsByStatus: StatusCount[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly url = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) { }

  get(from: string, to: string): Observable<Report> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<Report>(this.url, { params });
  }
}
