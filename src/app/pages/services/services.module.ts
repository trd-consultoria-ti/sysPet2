import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ServicesComponent } from './services.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: ServicesComponent }
];

@NgModule({
  declarations: [
    ServicesComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class ServicesModule { }
