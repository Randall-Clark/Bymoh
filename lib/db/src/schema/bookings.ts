import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { businessesTable, servicesTable } from "./businesses";

export const bookingTypeEnum = pgEnum("booking_type", ["table", "service"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "completed", "cancelled", "no_show"]);

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  businessId: text("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  bookingType: bookingTypeEnum("booking_type").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  partySize: integer("party_size"),
  notes: text("notes"),
  status: bookingStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
