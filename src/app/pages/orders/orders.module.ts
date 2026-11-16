import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { OrdersComponent } from './orders.component';
import { OrderReceiptComponent } from './order-receipt/order-receipt.component';

const routes: Routes = [
  { path: '', component: OrdersComponent },
  { path: ':id/receipt', component: OrderReceiptComponent }
];

@NgModule({
  declarations: [OrdersComponent, OrderReceiptComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class OrdersModule { }
