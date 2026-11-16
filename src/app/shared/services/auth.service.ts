import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'collaborator' | 'customer';
  canManageProducts?: boolean;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(user => this.setSession(user)),
      catchError(err => {
        this.clearSession();
        return throwError(err);
      })
    );
  }

  private setSession(user: User): void {
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (user.token) localStorage.setItem('authToken', user.token);
  }

  private clearSession(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  listUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  createUser(data: { name: string; email: string; password: string; role: User['role']; canManageProducts?: boolean }): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/users`, data);
  }

  updateUser(id: number, data: { name?: string; role?: User['role']; canManageProducts?: boolean }): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}`, data);
  }

  changePassword(id: number, currentPassword: string, newPassword: string): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${environment.apiUrl}/users/${id}/password`, { currentPassword, newPassword });
  }

  register(name: string, email: string, password: string, consent: boolean): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, { name, email, password, consent }).pipe(
      tap(user => this.setSession(user))
    );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      // Revoga a sessão no servidor; falha de rede não impede o logout local
      this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });
    }
    this.clearSession();
  }

  exportMyData(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/me/export`, { responseType: 'blob' });
  }

  deleteMyAccount(password: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${environment.apiUrl}/me`, { body: { password } });
  }

  forgotPassword(email: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${environment.apiUrl}/auth/forgot`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${environment.apiUrl}/auth/reset`, { token, newPassword });
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isCollaborator(): boolean {
    const user = this.getCurrentUser();
    return !!user && (user.role === 'collaborator' || user.role === 'admin');
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }

  canManageProducts(): boolean {
    const user = this.getCurrentUser();
    return !!user && (user.role === 'admin' || !!user.canManageProducts);
  }
}
