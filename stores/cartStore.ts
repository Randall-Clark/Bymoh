import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, CatalogItem, SelectedOption } from '@/types';

/** Génère une clé stable pour identifier une ligne panier (article + options) */
function makeCartKey(serviceId: string, selectedOptions?: SelectedOption[]): string {
  if (!selectedOptions || selectedOptions.length === 0) return serviceId;
  // Trier par groupId pour que l'ordre de sélection n'ait pas d'importance
  const sorted = [...selectedOptions].sort((a, b) => a.groupId.localeCompare(b.groupId));
  return `${serviceId}::${JSON.stringify(sorted)}`;
}

interface CartState {
  items: CartItem[];
  businessId: string | null;
  businessName: string | null;
  addItem: (
    item: CatalogItem,
    businessId: string,
    businessName: string,
    selectedOptions?: SelectedOption[],
    customPrice?: number,
  ) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalAmount: () => number;
}

function makeCartItem(
  item: CatalogItem,
  businessId: string,
  businessName: string,
  selectedOptions?: SelectedOption[],
  customPrice?: number,
): CartItem {
  const cartKey = makeCartKey(item.id, selectedOptions);
  return {
    service_id:     item.id,
    cartKey,
    title:          item.title,
    price:          customPrice !== undefined ? customPrice : (item.price ?? 0),
    quantity:       1,
    business_id:    businessId,
    business_name:  businessName,
    kind:           item.kind ?? '',
    selectedOptions: selectedOptions && selectedOptions.length > 0 ? selectedOptions : undefined,
    customPrice:    customPrice,
    ...((item as any).image_url ? { image_url: (item as any).image_url } : {}),
  } as CartItem;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      businessId: null,
      businessName: null,

      addItem: (
        item: CatalogItem,
        businessId: string,
        businessName: string,
        selectedOptions?: SelectedOption[],
        customPrice?: number,
      ) => {
        const cartKey = makeCartKey(item.id, selectedOptions);
        set((state: CartState) => {
          if (state.businessId && state.businessId !== businessId) {
            return {
              businessId,
              businessName,
              items: [makeCartItem(item, businessId, businessName, selectedOptions, customPrice)],
            };
          }
          // Chercher par cartKey pour différencier les variantes
          const existing = state.items.find((i) => i.cartKey === cartKey);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            };
          }
          return {
            businessId,
            businessName,
            items: [...state.items, makeCartItem(item, businessId, businessName, selectedOptions, customPrice)],
          };
        });
      },

      removeItem: (cartKey: string) =>
        set((state: CartState) => {
          // Support ancienne clé (service_id seul) pour rétrocompatibilité
          const updated = state.items.filter(
            (i) => i.cartKey !== cartKey && i.service_id !== cartKey,
          );
          return {
            items: updated,
            ...(updated.length === 0 ? { businessId: null, businessName: null } : {}),
          };
        }),

      updateQuantity: (cartKey: string, quantity: number) =>
        set((state: CartState) => {
          if (quantity <= 0) {
            const updated = state.items.filter(
              (i) => i.cartKey !== cartKey && i.service_id !== cartKey,
            );
            return {
              items: updated,
              ...(updated.length === 0 ? { businessId: null, businessName: null } : {}),
            };
          }
          return {
            items: state.items.map((i) =>
              (i.cartKey === cartKey || i.service_id === cartKey)
                ? { ...i, quantity }
                : i,
            ),
          };
        }),

      clearCart: () => set({ items: [], businessId: null, businessName: null }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: 'bymoh-cart',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
