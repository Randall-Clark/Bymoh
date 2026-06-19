import { boolean, integer, pgEnum, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const bookingModeEnum = pgEnum("booking_mode", ["table", "service", "none"]);
export const dayOfWeekEnum = pgEnum("day_of_week", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

export const businessesTable = pgTable("businesses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  categoryIcon: text("category_icon").notNull().default("briefcase"),
  sector: text("sector"),
  description: text("description").notNull().default(""),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address").notNull(),
  city: text("city").notNull().default("Lomé"),
  coverUrl: text("cover_url"),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  hasDelivery: boolean("has_delivery").notNull().default(false),
  isOpen: boolean("is_open").notNull().default(true),
  openHour: text("open_hour").notNull().default("08:00"),
  closeHour: text("close_hour").notNull().default("18:00"),
  bookingMode: bookingModeEnum("booking_mode").notNull().default("service"),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  forfaitPaid: boolean("forfait_paid").notNull().default(false),
  latitude: real("latitude"),
  longitude: real("longitude"),
  employeeCount: integer("employee_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const businessHoursTable = pgTable("business_hours", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  businessId: text("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
  openTime: text("open_time").notNull().default("08:00"),
  closeTime: text("close_time").notNull().default("18:00"),
  isClosed: boolean("is_closed").notNull().default(false),
});

export const servicesTable = pgTable("services", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  businessId: text("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  price: real("price").notNull(),
  currency: text("currency").notNull().default("FCFA"),
  imageUrl: text("image_url"),
  durationMinutes: integer("duration_minutes"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({
  id: true, rating: true, reviewCount: true, createdAt: true, updatedAt: true,
});
export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true });
export const insertBusinessHoursSchema = createInsertSchema(businessHoursTable).omit({ id: true });

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
export type Service = typeof servicesTable.$inferSelect;
export type BusinessHours = typeof businessHoursTable.$inferSelect;
