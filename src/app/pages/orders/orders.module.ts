import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrdersComponent } from './orders.component';
import { OrderReceiptComponent } from './order-receipt/order-receipt.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: OrdersComponent },
  { path: ':id/receipt', component: OrderReceiptComponent }
];

@NgModule({
  declarations: [OrdersComponent, OrderReceiptComponent],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class OrdersModule { }
