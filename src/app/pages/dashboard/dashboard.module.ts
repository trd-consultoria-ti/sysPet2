import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DashboardComponent } from './dashboard.component';
import { DashboardHomeComponent } from './dashboard-home/dashboard-home.component';
import { AdminAppointmentsComponent } from './admin-appointments/admin-appointments.component';
import { InventoryComponent } from './inventory/inventory.component';
import { AdminServicesComponent } from './admin-services/admin-services.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminCashComponent } from './admin-cash/admin-cash.component';
import { AdminReportsComponent } from './admin-reports/admin-reports.component';
import { AdminConsultationsComponent } from './admin-consultations/admin-consultations.component';
import { AdminVetsComponent } from './admin-vets/admin-vets.component';
import { AdminDailyQueueComponent } from './admin-daily-queue/admin-daily-queue.component';
import { AdminGuard } from '../../shared/guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', component: DashboardHomeComponent },
      { path: 'customers', loadChildren: () => import('../customers/customers.module').then(m => m.CustomersModule) },
      { path: 'daily-queue', component: AdminDailyQueueComponent },
      { path: 'appointments', component: AdminAppointmentsComponent },
      { path: 'consultations', component: AdminConsultationsComponent },
      { path: 'vets', component: AdminVetsComponent },
      { path: 'orders', loadChildren: () => import('../orders/orders.module').then(m => m.OrdersModule) },
      { path: 'inventory', component: InventoryComponent },
      { path: 'services', component: AdminServicesComponent, canActivate: [AdminGuard] },
      { path: 'users', component: AdminUsersComponent, canActivate: [AdminGuard] },
      { path: 'cash', component: AdminCashComponent, canActivate: [AdminGuard] },
      { path: 'reports', component: AdminReportsComponent, canActivate: [AdminGuard] }
    ]
  }
];

@NgModule({
  declarations: [
    DashboardComponent,
    DashboardHomeComponent,
    AdminDailyQueueComponent,
    AdminAppointmentsComponent,
    InventoryComponent,
    AdminServicesComponent,
    AdminUsersComponent,
    AdminCashComponent,
    AdminReportsComponent,
    AdminConsultationsComponent,
    AdminVetsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class DashboardModule { }
