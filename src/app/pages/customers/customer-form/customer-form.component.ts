import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Customer } from '../../../shared/models/customer.model';
import { CustomerService } from '../../../shared/services/customer.service';

@Component({
  selector: 'app-customer-form',
  templateUrl: './customer-form.component.html',
  styleUrls: ['./customer-form.component.scss']
})
export class CustomerFormComponent implements OnInit {
  customerForm: FormGroup;
  customerId: number | null = null;
  isEditMode = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService
  ) {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      status: ['active', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.customerId = +id;
        this.isEditMode = true;
        this.loadCustomer();
      }
    });
  }

  loadCustomer(): void {
    if (this.customerId) {
      this.customerService.getCustomers().subscribe(customers => {
        const customer = customers.find(c => c.id === this.customerId);
        if (customer) {
          this.customerForm.patchValue({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            status: customer.status
          });
        }
      });
    }
  }

  onSubmit(): void {
    if (this.customerForm.valid) {
      const formValues = this.customerForm.value;

      if (this.isEditMode && this.customerId) {
        const existing = this.customerService.getById(this.customerId);
        if (existing) {
          this.customerService.updateCustomer({
            ...existing,
            name: formValues.name,
            email: formValues.email,
            phone: formValues.phone,
            status: formValues.status
          }).subscribe(() => this.router.navigate(['/customers', this.customerId]));
          return;
        }
        this.router.navigate(['/customers', this.customerId]);
      } else {
        this.customerService.addCustomer({
          name: formValues.name,
          email: formValues.email,
          phone: formValues.phone,
          status: formValues.status
        }).subscribe(created => this.router.navigate(['/customers', created.id]));
      }
    }
  }

  onCancel(): void {
    if (this.isEditMode && this.customerId) {
      this.router.navigate(['/customers', this.customerId]);
    } else {
      this.router.navigate(['/customers']);
    }
  }
}
