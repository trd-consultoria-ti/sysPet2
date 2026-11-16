import { Component, OnInit } from '@angular/core';
import { Customer } from '../../shared/models/customer.model';
import { CustomerService } from '../../shared/services/customer.service';

@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss']
})
export class CustomersComponent implements OnInit {
  customers: Customer[] = [];

  filteredCustomers: Customer[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  searchTerm: string = '';

  constructor(private customerService: CustomerService) { }

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe(customers => {
      this.customers = [...customers];
      this.applyFilters();
    });
  }

  applyFilters(): void {
    let result = [...this.customers];

    // Aplicar filtro de status
    if (this.activeFilter === 'active') {
      result = result.filter(customer => customer.status === 'active');
    } else if (this.activeFilter === 'inactive') {
      result = result.filter(customer => customer.status === 'inactive');
    }

    // Aplicar filtro de pesquisa
    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(customer =>
        customer.name.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term) ||
        customer.phone.includes(term)
      );
    }

    this.filteredCustomers = result;
  }

  setFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  getPetCount(customer: Customer): number {
    return customer.pets?.length || 0;
  }
}
