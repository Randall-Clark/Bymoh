import { useCartStore } from '@/stores/cartStore';
import type { CatalogItem } from '@/types';

export function useCart() {
  const store = useCartStore();

  const addToCart = (item: CatalogItem, businessId: string, businessName: string) => {
    store.addItem(item, businessId, businessName);
  };

  const removeFromCart = (serviceId: string) => {
    store.removeItem(serviceId);
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    store.updateQuantity(serviceId, quantity);
  };

  return {
    items: store.items,
    businessId: store.businessId,
    businessName: store.businessName,
    totalItems: store.totalItems(),
    totalAmount: store.totalAmount(),
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart: store.clearCart,
  };
}
