import { pgEnum, pgTable, real, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { businessesTable, servicesTable } from "./businesses";

export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"]);
export const deliveryMethodEnum = pgEnum("delivery_method", ["delivery", "pickup"]);

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  businessId: text("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull().default("pending"),
  deliveryMethod: deliveryMethodEnum("delivery_method").notNull().default("pickup"),
  deliveryAddress: text("delivery_address"),
  deliveryFee: real("delivery_fee").notNull().default(0),
  subtotal: real("subtotal").notNull(),
  total: real("total").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  currency: text("currency").notNull().default("FCFA"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
