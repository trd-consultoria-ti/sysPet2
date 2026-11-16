import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Contrato da API: GET/POST /api/coupons retornam couponJson camelCase
export interface Coupon {
  id?: number;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderTotal?: number;
  active?: boolean;
  maxUses?: number | null;
  usedCount?: number;
  expiresAt?: string | null;
  createdAt?: string;
}

export interface CouponPayload {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderTotal?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  active?: boolean;
}

export interface CouponValidation {
  valid: boolean;
  code?: string;
  type?: 'percent' | 'fixed';
  value?: number;
  discount?: number;
  finalTotal?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CouponService {
  private readonly url = `${environment.apiUrl}/coupons`;

  constructor(private http: HttpClient) { }

  validate(code: string, total: number): Observable<CouponValidation> {
    return this.http.post<CouponValidation>(`${this.url}/validate`, { code, total });
  }

  list(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(this.url);
  }

  create(coupon: CouponPayload): Observable<Coupon> {
    return this.http.post<Coupon>(this.url, coupon);
  }

  update(id: number, coupon: Partial<CouponPayload>): Observable<Coupon> {
    return this.http.put<Coupon>(`${this.url}/${id}`, coupon);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
