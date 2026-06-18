import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CartItem, Service } from "@/constants/types";

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (service: Service, businessId: string, businessName: string) => void;
  removeItem: (serviceId: string) => void;
  updateQuantity: (serviceId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "@lokali_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then((raw) => {
      if (raw) setItems(JSON.parse(raw));
    });
  }, []);

  const persist = (newItems: CartItem[]) =>
    AsyncStorage.setItem(CART_KEY, JSON.stringify(newItems));

  const addItem = useCallback((service: Service, businessId: string, businessName: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.service.id === service.id);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((i) =>
          i.service.id === service.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        updated = [...prev, { service, businessId, businessName, quantity: 1 }];
      }
      persist(updated);
      return updated;
    });
  }, []);

  const removeItem = useCallback((serviceId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.service.id !== serviceId);
      persist(updated);
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((serviceId: string, quantity: number) => {
    setItems((prev) => {
      const updated =
        quantity <= 0
          ? prev.filter((i) => i.service.id !== serviceId)
          : prev.map((i) =>
              i.service.id === serviceId ? { ...i, quantity } : i
            );
      persist(updated);
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    AsyncStorage.removeItem(CART_KEY);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.service.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
