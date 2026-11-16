import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { DashboardComponent } from './dashboard.component';
import { DashboardHomeComponent } from './dashboard-home/dashboard-home.component';
import { AdminAppointmentsComponent } from './admin-appointments/admin-appointments.component';
import { InventoryComponent } from './inventory/inventory.component';
import { AdminServicesComponent } from './admin-services/admin-services.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminCashComponent } from './admin-cash/admin-cash.component';
import { AdminGuard } from '../../shared/guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', component: DashboardHomeComponent },
      { path: 'customers', loadChildren: () => import('../customers/customers.module').then(m => m.CustomersModule) },
      { path: 'appointments', component: AdminAppointmentsComponent },
      { path: 'orders', loadChildren: () => import('../orders/orders.module').then(m => m.OrdersModule) },
      { path: 'inventory', component: InventoryComponent },
      { path: 'services', component: AdminServicesComponent, canActivate: [AdminGuard] },
      { path: 'users', component: AdminUsersComponent, canActivate: [AdminGuard] },
      { path: 'cash', component: AdminCashComponent, canActivate: [AdminGuard] }
    ]
  }
];

@NgModule({
  declarations: [
    DashboardComponent,
    DashboardHomeComponent,
    AdminAppointmentsComponent,
    InventoryComponent,
    AdminServicesComponent,
    AdminUsersComponent,
    AdminCashComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class DashboardModule { }
