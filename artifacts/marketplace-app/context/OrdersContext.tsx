import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Booking, Order } from "@/constants/types";

interface OrdersContextValue {
  bookings: Booking[];
  orders: Order[];
  addBooking: (booking: Booking) => Promise<void>;
  addOrder: (order: Order) => Promise<void>;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

const BOOKINGS_KEY = "@kola_bookings";
const ORDERS_KEY = "@kola_orders";

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    AsyncStorage.multiGet([BOOKINGS_KEY, ORDERS_KEY]).then((results) => {
      const [bResult, oResult] = results;
      if (bResult[1]) setBookings(JSON.parse(bResult[1]));
      if (oResult[1]) setOrders(JSON.parse(oResult[1]));
    });
  }, []);

  const addBooking = useCallback(async (booking: Booking) => {
    setBookings((prev) => {
      const next = [booking, ...prev];
      AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addOrder = useCallback(async (order: Order) => {
    setOrders((prev) => {
      const next = [order, ...prev];
      AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <OrdersContext.Provider value={{ bookings, orders, addBooking, addOrder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
