import { ProductCardComponent } from './product-card.component';
import { Product } from 'src/app/shared/models/product.model';

describe('ProductCardComponent', () => {
  const product: Product = {
    id: 1,
    name: 'Ração',
    price: 99.9,
    rating: 4.5,
    reviews: 10,
    image: '',
    category: 'Alimentação',
    description: 'Ração premium',
    stock: 10
  };

  function makeComponent(p: Product) {
    const cartService = jasmine.createSpyObj('CartService', ['add']);
    const component = new ProductCardComponent(cartService);
    component.product = p;
    return { component, cartService };
  }

  it('addToCart chama cartService.add quando há estoque', () => {
    const { component, cartService } = makeComponent(product);
    component.addToCart();
    expect(cartService.add).toHaveBeenCalledWith(product);
  });

  it('outOfStock quando stock === 0 e não adiciona ao carrinho', () => {
    const { component, cartService } = makeComponent({ ...product, stock: 0 });
    expect(component.outOfStock).toBeTrue();
    component.addToCart();
    expect(cartService.add).not.toHaveBeenCalled();
  });

  it('lowStock entre 1 e 5 unidades', () => {
    expect(makeComponent({ ...product, stock: 3 }).component.lowStock).toBeTrue();
    expect(makeComponent({ ...product, stock: 6 }).component.lowStock).toBeFalse();
    expect(makeComponent({ ...product, stock: null }).component.lowStock).toBeFalse();
  });

  it('stock null se comporta como ilimitado', () => {
    const { component } = makeComponent({ ...product, stock: null });
    expect(component.outOfStock).toBeFalse();
    expect(component.lowStock).toBeFalse();
  });
});
