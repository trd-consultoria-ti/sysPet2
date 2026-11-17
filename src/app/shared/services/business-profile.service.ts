import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { BusinessProfile, DEFAULT_BUSINESS_PROFILE } from '../models/business-profile.model';

const STORAGE_KEY_PROFILE = 'syspet_business_profile_v1';

@Injectable({
  providedIn: 'root'
})
export class BusinessProfileService {
  private profile$ = new BehaviorSubject<BusinessProfile>(this.loadProfile());

  constructor(private http: HttpClient) {
    this.refresh();
  }

  private loadProfile(): BusinessProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler business profile do localStorage', e);
    }
    return DEFAULT_BUSINESS_PROFILE;
  }

  private saveProfile(profile: BusinessProfile): void {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
      this.profile$.next(profile);
    } catch (e) {
      console.warn('Erro ao salvar business profile no localStorage', e);
    }
  }

  getProfile(): Observable<BusinessProfile> {
    return this.http.get<BusinessProfile>('/api/business-profile').pipe(
      tap(profile => this.saveProfile(profile)),
      catchError(() => this.profile$.asObservable())
    );
  }

  getProfileSnapshot(): BusinessProfile {
    return this.profile$.getValue();
  }

  updateProfile(profile: BusinessProfile): Observable<BusinessProfile> {
    return this.http.put<BusinessProfile>('/api/business-profile', profile).pipe(
      catchError(() => of(profile)),
      tap(saved => this.saveProfile(saved))
    );
  }

  refresh(): void {
    this.http.get<BusinessProfile>('/api/business-profile').subscribe({
      next: p => this.saveProfile(p),
      error: () => {}
    });
  }
}
