import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Order } from '../../shared/models/order.model';
import { CartService } from '../../shared/services/cart.service';
import { OrderService } from '../../shared/services/order.service';
import { AuthService } from '../../shared/services/auth.service';
import { CouponService } from '../../shared/services/coupon.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  checkoutForm: FormGroup;
  completedOrder: Order | null = null;
  submitError = '';
  couponCode = '';
  couponDiscount = 0;
  couponMessage = '';
  couponApplied = '';
  applyingCoupon = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cartService: CartService,
    private orderService: OrderService,
    private authService: AuthService,
    private couponService: CouponService
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
    // Cupom é validado contra o total do momento — se o carrinho mudar, invalida
    this.cartService.items$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.couponApplied) {
        this.removeCoupon();
        this.couponMessage = 'Carrinho alterado — reaplique o cupom.';
      }
    });
  }

  get cartItems() {
    return this.cartService.getItems();
  }

  get cartTotal(): number {
    return this.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  get finalTotal(): number {
    return Math.max(0, this.cartTotal - this.couponDiscount);
  }

  applyCoupon(): void {
    const code = this.couponCode.trim();
    if (!code) {
      return;
    }
    this.applyingCoupon = true;
    this.couponMessage = '';
    this.couponService.validate(code, this.cartTotal).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.applyingCoupon = false;
        if (res.valid && (res.discount ?? 0) > 0) {
          this.couponDiscount = res.discount!;
          this.couponApplied = code;
          this.couponMessage = `Cupom ${code} aplicado.`;
        } else {
          this.couponDiscount = 0;
          this.couponApplied = '';
          this.couponMessage = res.message || 'Cupom inválido.';
        }
      },
      error: () => {
        this.applyingCoupon = false;
        this.couponDiscount = 0;
        this.couponApplied = '';
        this.couponMessage = 'Cupons ainda não disponíveis no servidor.';
      }
    });
  }

  removeCoupon(): void {
    this.couponCode = '';
    this.couponDiscount = 0;
    this.couponApplied = '';
    this.couponMessage = '';
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
        userId: user?.id,
        couponCode: this.couponApplied || undefined
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: order => {
          this.submitError = '';
          this.completedOrder = order;
          this.cartService.clear();
        },
        error: err => {
          this.submitError = err?.error?.error || 'Não foi possível concluir o pedido. Tente novamente.';
        }
      });
    }
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
