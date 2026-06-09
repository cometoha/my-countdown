import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


// 用户表
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    nickname: varchar("nickname", { length: 64 }).notNull(),
    avatar_url: text("avatar_url"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_created_at_idx").on(table.created_at),
  ]
);

// 旅行方案表
export const travelPlans = pgTable(
  "travel_plans",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 128 }).notNull(),
    destination: varchar("destination", { length: 128 }),
    duration: integer("duration"),
    budget: varchar("budget", { length: 32 }),
    season: varchar("season", { length: 32 }),
    transport: varchar("transport", { length: 32 }),
    plan_detail: jsonb("plan_detail"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("travel_plans_user_id_idx").on(table.user_id),
    index("travel_plans_created_at_idx").on(table.created_at),
  ]
);
