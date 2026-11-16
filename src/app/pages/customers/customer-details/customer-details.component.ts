import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Customer } from '../../../shared/models/customer.model';
import { Pet } from '../../../shared/models/pet.model';
import { CustomerService } from '../../../shared/services/customer.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-customer-details',
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.scss']
})
export class CustomerDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  customerId: number | null = null;
  customer: Customer | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.customerId = +id;
      }
    });

    this.customerService.getCustomers().pipe(takeUntil(this.destroy$)).subscribe(customers => {
      this.customer = customers.find(c => c.id === this.customerId) || null;
    });
  }

  deletePet(pet: Pet): void {
    if (this.customer && this.customer.pets && this.customerId && pet.id) {
      if (!confirm(`Excluir o pet ${pet.name}?`)) {
        return;
      }
      this.customerService.deletePet(this.customerId, pet.id).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  editCustomer(): void {
    if (this.customerId) {
      this.router.navigate(['/customers', this.customerId, 'edit']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
