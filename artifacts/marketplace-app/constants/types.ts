export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  pin?: string;
  role: "client" | "pro";
  businessIds: string[];
  favoriteIds: string[];
  avatar?: string;
  countryCode?: string;
}

export interface Business {
  id: string;
  ownerId?: string;
  name: string;
  category: string;
  categoryIcon: string;
  description: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  isOpen: boolean;
  openHour: string;
  closeHour: string;
  services: Service[];
  hasDelivery: boolean;
  distance: string;
  employeeCount?: number;
  openingHours?: OpeningHours;
  isVerified?: boolean;
  requiresPrepayment?: boolean;
}

export type OpeningHours = {
  [day: string]: { open: string; close: string; closed: boolean };
};

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export interface CartItem {
  service: Service;
  businessId: string;
  businessName: string;
  quantity: number;
}

export interface Booking {
  id: string;
  businessId: string;
  businessName: string;
  businessCategory: string;
  serviceName: string;
  servicePrice: number;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  paymentMethod?: "online" | "on_site";
  partySize?: number;
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  businessId: string;
  businessName: string;
  businessCategory: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  status: "pending" | "confirmed" | "in_delivery" | "completed" | "cancelled";
  deliveryMethod: "gozem" | "yango" | "pickup";
  createdAt: string;
}

export type DeliveryProvider = "gozem" | "yango";
