import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";
import { usersTable } from "./users";

export const walletTypeEnum = pgEnum("wallet_type", ["personal", "business"]);
export const txTypeEnum = pgEnum("tx_type", ["credit", "debit", "pending"]);

export const walletsTable = pgTable("wallets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: walletTypeEnum("type").notNull(),
  businessId: text("business_id").references(() => businessesTable.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  walletId: text("wallet_id").notNull().references(() => walletsTable.id, { onDelete: "cascade" }),
  type: txTypeEnum("type").notNull(),
  label: text("label").notNull(),
  sublabel: text("sublabel"),
  amount: integer("amount").notNull(),
  paymentRef: text("payment_ref"),
  relatedOrderId: text("related_order_id"),
  relatedBookingId: text("related_booking_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
