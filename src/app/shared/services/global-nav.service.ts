import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GlobalNavService {
  private isOpenSubject = new BehaviorSubject<boolean>(false);
  public isOpen$: Observable<boolean> = this.isOpenSubject.asObservable();

  constructor(private ngZone: NgZone) {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (event: KeyboardEvent) => {
        // Atalho Ctrl+K ou Cmd+K para abrir/fechar
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          this.ngZone.run(() => this.toggle());
        } else if (event.key === 'Escape' && this.isOpenSubject.value) {
          this.ngZone.run(() => this.close());
        }
      });
    }
  }

  get isOpen(): boolean {
    return this.isOpenSubject.value;
  }

  open(): void {
    this.isOpenSubject.next(true);
  }

  close(): void {
    this.isOpenSubject.next(false);
  }

  toggle(): void {
    this.isOpenSubject.next(!this.isOpenSubject.value);
  }
}
