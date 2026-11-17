export interface Product {
  id: number;
  name: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  description: string;
  stock?: number | null;
  minStock?: number | null;
  costPrice?: number | null;
  supplier?: string;
  barcode?: string;
}
