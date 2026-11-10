import { useCartStore } from '@/stores/cartStore';
import type { CatalogItem, SelectedOption } from '@/types';

export function useCart() {
  const store = useCartStore();

  const addToCart = (
    item: CatalogItem,
    businessId: string,
    businessName: string,
    selectedOptions?: SelectedOption[],
    customPrice?: number,
  ) => {
    store.addItem(item, businessId, businessName, selectedOptions, customPrice);
  };

  const removeFromCart = (cartKey: string) => {
    store.removeItem(cartKey);
  };

  const updateQuantity = (cartKey: string, quantity: number) => {
    store.updateQuantity(cartKey, quantity);
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
