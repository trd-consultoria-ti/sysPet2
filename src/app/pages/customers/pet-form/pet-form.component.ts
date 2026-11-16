import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Customer } from '../../../shared/models/customer.model';
import { Pet } from '../../../shared/models/pet.model';
import { CustomerService } from '../../../shared/services/customer.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-pet-form',
  templateUrl: './pet-form.component.html',
  styleUrls: ['./pet-form.component.scss']
})
export class PetFormComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  petForm: FormGroup;
  customerId: number | null = null;
  petId: number | null = null;
  isEditMode = false;
  customer: Customer | null = null;
  pet: Pet | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService
  ) {
    this.petForm = this.fb.group({
      name: ['', [Validators.required]],
      type: ['Cachorro', [Validators.required]],
      breed: [''],
      age: [null]
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const customerId = params.get('customerId');
      const petId = params.get('petId');

      if (customerId) {
        this.customerId = +customerId;
        this.loadCustomer();
      }

      if (petId) {
        this.petId = +petId;
        this.isEditMode = true;
        this.loadPet();
      }
    });
  }

  loadCustomer(): void {
    if (this.customerId) {
      this.customerService.getCustomers().pipe(takeUntil(this.destroy$)).subscribe(customers => {
        this.customer = customers.find(c => c.id === this.customerId) || null;
        if (this.petId) {
          this.loadPet();
        }
      });
    }
  }

  loadPet(): void {
    if (this.customerId && this.petId && this.customer?.pets) {
      this.pet = this.customer.pets.find(p => p.id === this.petId) || null;

      if (this.pet) {
        this.petForm.patchValue({
          name: this.pet.name,
          type: this.pet.type,
          breed: this.pet.breed || '',
          age: this.pet.age || null
        });
      }
    }
  }

  onSubmit(): void {
    if (this.petForm.valid && this.customerId) {
      const formValues = this.petForm.value;

      const done = () => this.router.navigate(['/customers', this.customerId]);

      if (this.isEditMode && this.pet) {
        this.customerService.updatePet(this.customerId, {
          ...this.pet,
          name: formValues.name,
          type: formValues.type,
          breed: formValues.breed || undefined,
          age: formValues.age || undefined
        }).pipe(takeUntil(this.destroy$)).subscribe(done);
      } else {
        this.customerService.addPet(this.customerId, {
          name: formValues.name,
          type: formValues.type,
          breed: formValues.breed || undefined,
          age: formValues.age || undefined
        }).pipe(takeUntil(this.destroy$)).subscribe(done);
      }
    }
  }

  onCancel(): void {
    if (this.customerId) {
      this.router.navigate(['/customers', this.customerId]);
    } else {
      this.router.navigate(['/customers']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
