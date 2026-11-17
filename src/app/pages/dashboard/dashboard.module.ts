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
import { DailyQueueHeaderComponent } from './admin-daily-queue/daily-queue-header/daily-queue-header.component';
import { AdminTaxiComponent } from './admin-taxi/admin-taxi.component';
import { AdminWhatsappComponent } from './admin-whatsapp/admin-whatsapp.component';
import { AdminMedicationsComponent } from './admin-medications/admin-medications.component';
import { AdminSystemMapComponent } from './admin-system-map/admin-system-map.component';
import { AdminGroomersComponent } from './admin-groomers/admin-groomers.component';
import { AdminPackagesComponent } from './admin-packages/admin-packages.component';
import { AdminSettingsComponent } from './admin-settings/admin-settings.component';
import { AdminGuard } from '../../shared/guards/admin.guard';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', component: DashboardHomeComponent },
      { path: 'rotas', component: AdminSystemMapComponent },
      { path: 'customers', loadChildren: () => import('../customers/customers.module').then(m => m.CustomersModule) },
      { path: 'daily-queue', component: AdminDailyQueueComponent },
      { path: 'packages', component: AdminPackagesComponent },
      { path: 'taxi', component: AdminTaxiComponent },
      { path: 'whatsapp', component: AdminWhatsappComponent },
      { path: 'appointments', component: AdminAppointmentsComponent },
      { path: 'consultations', component: AdminConsultationsComponent },
      { path: 'vets', component: AdminVetsComponent },
      { path: 'orders', loadChildren: () => import('../orders/orders.module').then(m => m.OrdersModule) },
      { path: 'inventory', component: InventoryComponent },
      { path: 'groomers', component: AdminGroomersComponent, canActivate: [AdminGuard] },
      { path: 'medications', component: AdminMedicationsComponent },
      { path: 'services', component: AdminServicesComponent, canActivate: [AdminGuard] },
      { path: 'users', component: AdminUsersComponent, canActivate: [AdminGuard] },
      { path: 'cash', component: AdminCashComponent, canActivate: [AdminGuard] },
      { path: 'settings', component: AdminSettingsComponent, canActivate: [AdminGuard] },
      { path: 'reports', component: AdminReportsComponent, canActivate: [AdminGuard] }
    ]
  }
];

@NgModule({
  declarations: [
    DashboardComponent,
    DashboardHomeComponent,
    AdminDailyQueueComponent,
    DailyQueueHeaderComponent,
    AdminPackagesComponent,
    AdminTaxiComponent,
    AdminWhatsappComponent,
    AdminAppointmentsComponent,
    InventoryComponent,
    AdminMedicationsComponent,
    AdminServicesComponent,
    AdminUsersComponent,
    AdminCashComponent,
    AdminReportsComponent,
    AdminConsultationsComponent,
    AdminVetsComponent,
    AdminGroomersComponent,
    AdminSettingsComponent,
    AdminSystemMapComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    SharedModule
  ]
})
export class DashboardModule { }
