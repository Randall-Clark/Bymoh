import { boolean, pgEnum, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const driverStatusEnum = pgEnum("driver_status", ["pending", "approved", "suspended", "rejected"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", ["moto", "voiture", "velo", "tricycle"]);
export const deliveryRequestStatusEnum = pgEnum("delivery_request_status", [
  "pending", "assigned", "picked_up", "delivered", "cancelled",
]);

export const driversTable = pgTable("drivers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  status: driverStatusEnum("status").notNull().default("pending"),
  licenseNumber: text("license_number").notNull(),
  licenseExpiry: text("license_expiry"),
  licensePhotoUrl: text("license_photo_url"),
  idPhotoUrl: text("id_photo_url"),
  vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
  vehicleModel: text("vehicle_model").notNull(),
  vehiclePlate: text("vehicle_plate").notNull(),
  vehiclePhotoUrl: text("vehicle_photo_url"),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLat: real("current_lat"),
  currentLng: real("current_lng"),
  totalDeliveries: text("total_deliveries").notNull().default("0"),
  rating: real("rating").notNull().default(0),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveryRequestsTable = pgTable("delivery_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  driverId: text("driver_id").references(() => driversTable.id, { onDelete: "set null" }),
  status: deliveryRequestStatusEnum("status").notNull().default("pending"),
  pickupAddress: text("pickup_address"),
  deliveryAddress: text("delivery_address"),
  pickupLat: real("pickup_lat"),
  pickupLng: real("pickup_lng"),
  deliveryLat: real("delivery_lat"),
  deliveryLng: real("delivery_lng"),
  pickedUpAt: timestamp("picked_up_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDriverSchema = createInsertSchema(driversTable).omit({
  id: true, status: true, isAvailable: true, totalDeliveries: true, rating: true, createdAt: true, updatedAt: true,
});
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;
export type DeliveryRequest = typeof deliveryRequestsTable.$inferSelect;
