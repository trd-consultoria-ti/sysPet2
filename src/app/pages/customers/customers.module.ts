import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { CustomersComponent } from './customers.component';
import { CustomerDetailsComponent } from './customer-details/customer-details.component';
import { CustomerFormComponent } from './customer-form/customer-form.component';
import { PetFormComponent } from './pet-form/pet-form.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: CustomersComponent },
  { path: 'new', component: CustomerFormComponent },
  { path: ':id/edit', component: CustomerFormComponent },
  { path: ':id', component: CustomerDetailsComponent },
  { path: ':customerId/pets/new', component: PetFormComponent },
  { path: ':customerId/pets/:petId/edit', component: PetFormComponent }
];

@NgModule({
  declarations: [
    CustomersComponent,
    CustomerDetailsComponent,
    CustomerFormComponent,
    PetFormComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class CustomersModule { }
