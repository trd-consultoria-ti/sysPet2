import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Customer } from '../models/customer.model';
import { Pet } from '../models/pet.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private customersSubject = new BehaviorSubject<Customer[]>([]);
  public customers$ = this.customersSubject.asObservable();
  private readonly url = `${environment.apiUrl}/customers`;

  constructor(private http: HttpClient) {
    this.refresh();
  }

  refresh(): void {
    this.http.get<Customer[]>(this.url).subscribe({
      next: customers => this.customersSubject.next(customers),
      error: err => console.error('Falha ao carregar clientes', err)
    });
  }

  getCustomers(): Observable<Customer[]> {
    return this.customers$;
  }

  getById(id: number): Customer | undefined {
    return this.customersSubject.value.find(c => c.id === id);
  }

  addCustomer(customer: Omit<Customer, 'id' | 'pets'>): Observable<Customer> {
    return this.http.post<Customer>(this.url, customer).pipe(
      tap(created => this.customersSubject.next([...this.customersSubject.value, created]))
    );
  }

  updateCustomer(customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(`${this.url}/${customer.id}`, customer).pipe(
      tap(updated => {
        const list = this.customersSubject.value.map(c => c.id === updated.id ? { ...updated, pets: c.pets } : c);
        this.customersSubject.next(list);
      })
    );
  }

  addPet(customerId: number, pet: Omit<Pet, 'id' | 'customerId'>): Observable<Pet> {
    return this.http.post<Pet>(`${environment.apiUrl}/pets`, { ...pet, customerId }).pipe(
      tap(created => this.upsertPet(customerId, created))
    );
  }

  updatePet(customerId: number, pet: Pet): Observable<Pet> {
    return this.http.put<Pet>(`${environment.apiUrl}/pets/${pet.id}`, pet).pipe(
      tap(updated => this.upsertPet(customerId, { ...updated, customerId }))
    );
  }

  deletePet(customerId: number, petId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/pets/${petId}`).pipe(
      tap(() => {
        const list = this.customersSubject.value.map(c =>
          c.id === customerId ? { ...c, pets: (c.pets || []).filter(p => p.id !== petId) } : c
        );
        this.customersSubject.next(list);
      })
    );
  }

  private upsertPet(customerId: number, pet: Pet): void {
    const list = this.customersSubject.value.map(c => {
      if (c.id !== customerId) { return c; }
      const pets = c.pets || [];
      const exists = pets.some(p => p.id === pet.id);
      return { ...c, pets: exists ? pets.map(p => p.id === pet.id ? pet : p) : [...pets, pet] };
    });
    this.customersSubject.next(list);
  }
}
