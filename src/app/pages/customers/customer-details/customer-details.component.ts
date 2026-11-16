import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Customer } from '../../../shared/models/customer.model';
import { Pet } from '../../../shared/models/pet.model';
import { CustomerService } from '../../../shared/services/customer.service';

@Component({
  selector: 'app-customer-details',
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.scss']
})
export class CustomerDetailsComponent implements OnInit {
  customerId: number | null = null;
  customer: Customer | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.customerId = +id;
      }
    });

    this.customerService.getCustomers().subscribe(customers => {
      this.customer = customers.find(c => c.id === this.customerId) || null;
    });
  }

  deletePet(pet: Pet): void {
    if (this.customer && this.customer.pets && this.customerId && pet.id) {
      if (!confirm(`Excluir o pet ${pet.name}?`)) {
        return;
      }
      this.customerService.deletePet(this.customerId, pet.id).subscribe();
    }
  }

  editCustomer(): void {
    if (this.customerId) {
      this.router.navigate(['/customers', this.customerId, 'edit']);
    }
  }
}
