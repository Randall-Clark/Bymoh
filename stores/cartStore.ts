import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, CatalogItem } from '@/types';

interface CartState {
  items: CartItem[];
  businessId: string | null;
  businessName: string | null;
  addItem: (item: CatalogItem, businessId: string, businessName: string) => void;
  removeItem: (serviceId: string) => void;
  updateQuantity: (serviceId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalAmount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      businessId: null,
      businessName: null,

      addItem: (item, businessId, businessName) => {
        set((state) => {
          if (state.businessId && state.businessId !== businessId) {
            return {
              businessId,
              businessName,
              items: [{
                service_id: item.id,
                title: item.title,
                price: item.price,
                quantity: 1,
                business_id: businessId,
                business_name: businessName,
                kind: item.kind,
              }],
            };
          }
          const existing = state.items.find((i) => i.service_id === item.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.service_id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            };
          }
          return {
            businessId,
            businessName,
            items: [...state.items, {
              service_id: item.id,
              title: item.title,
              price: item.price,
              quantity: 1,
              business_id: businessId,
              business_name: businessName,
              kind: item.kind,
            }],
          };
        });
      },

      removeItem: (serviceId) =>
        set((state) => {
          const updated = state.items.filter((i) => i.service_id !== serviceId);
          return { items: updated, ...(updated.length === 0 ? { businessId: null, businessName: null } : {}) };
        }),

      updateQuantity: (serviceId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            const updated = state.items.filter((i) => i.service_id !== serviceId);
            return { items: updated, ...(updated.length === 0 ? { businessId: null, businessName: null } : {}) };
          }
          return {
            items: state.items.map((i) =>
              i.service_id === serviceId ? { ...i, quantity } : i,
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
