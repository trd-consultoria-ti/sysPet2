import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Order } from '../../shared/models/order.model';
import { CartService } from '../../shared/services/cart.service';
import { OrderService } from '../../shared/services/order.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  checkoutForm: FormGroup;
  completedOrder: Order | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cartService: CartService,
    private orderService: OrderService,
    private authService: AuthService
  ) {
    this.checkoutForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required]],
      paymentMethod: ['pix', [Validators.required]]
    });
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.checkoutForm.patchValue({
        name: user.name,
        email: user.email
      });
    }
    if (this.cartService.getItems().length === 0 && !this.completedOrder) {
      this.router.navigate(['/cart']);
    }
  }

  get cartItems() {
    return this.cartService.getItems();
  }

  get cartTotal(): number {
    return this.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  onSubmit(): void {
    if (this.checkoutForm.valid && this.cartItems.length > 0) {
      const formValues = this.checkoutForm.value;
      const user = this.authService.getCurrentUser();
      this.orderService.create({
        customerName: formValues.name,
        email: formValues.email,
        phone: formValues.phone,
        address: formValues.address,
        paymentMethod: formValues.paymentMethod,
        items: this.cartItems,
        userId: user?.id
      }).subscribe(order => {
        this.completedOrder = order;
        this.cartService.clear();
      });
    }
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
