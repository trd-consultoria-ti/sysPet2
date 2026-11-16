import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();
  private readonly url = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {
    this.http.get<Product[]>(this.url).subscribe({
      next: products => this.productsSubject.next(products),
      error: err => console.error('Falha ao carregar produtos', err)
    });
  }

  getProducts(): Observable<Product[]> {
    return this.products$;
  }

  getById(id: number): Product | undefined {
    return this.productsSubject.value.find(p => p.id === id);
  }

  update(product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.url}/${product.id}`, product).pipe(
      tap(updated => {
        const list = this.productsSubject.value.map(p => p.id === updated.id ? updated : p);
        this.productsSubject.next(list);
      })
    );
  }

  create(product: Omit<Product, 'id'>): Observable<Product> {
    return this.http.post<Product>(this.url, product).pipe(
      tap(created => this.productsSubject.next([...this.productsSubject.value, created]))
    );
  }

  uploadImage(file: File): Observable<{ url: string }> {
    return new Observable<{ url: string }>(observer => {
      const reader = new FileReader();
      reader.onload = () => {
        this.http.post<{ imagePath: string }>(`${environment.apiUrl}/upload`, {
          filename: file.name,
          data: reader.result as string
        }).subscribe({
          next: res => { observer.next({ url: res.imagePath }); observer.complete(); },
          error: err => observer.error(err)
        });
      };
      reader.onerror = () => observer.error(reader.error);
      reader.readAsDataURL(file);
    });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.productsSubject.next(this.productsSubject.value.filter(p => p.id !== id)))
    );
  }
}
