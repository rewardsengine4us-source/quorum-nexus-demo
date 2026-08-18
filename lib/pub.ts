"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const DEMO = "demo-user-001";

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (!client) {
    client = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Select all rows from a table. */
export async function all(table: string): Promise<any[]> {
  const { data, error } = await sb().from(table).select("*");
  if (error) throw new Error(`pub.all(${table}): ${error.message}`);
  return data || [];
}

/** Select rows scoped to the demo user. */
export async function mine(table: string): Promise<any[]> {
  const { data, error } = await sb().from(table).select("*").eq("user_id", DEMO);
  if (error) throw new Error(`pub.mine(${table}): ${error.message}`);
  return data || [];
}

/** Upsert a linked credit card for the demo user. */
export async function addCard(cardId: number | string, notes?: string): Promise<void> {
  const { error } = await sb()
    .from("user_cards")
    .upsert(
      { user_id: DEMO, credit_card_id: cardId, notes: notes || null },
      { onConflict: "user_id,credit_card_id" }
    );
  if (error) throw new Error(`pub.addCard: ${error.message}`);
}

/** Delete a row from a table by id. */
export async function delRow(table: string, id: number | string): Promise<void> {
  const { error } = await sb().from(table).delete().eq("id", id);
  if (error) throw new Error(`pub.delRow(${table}): ${error.message}`);
}

/** Upsert a points balance for a loyalty program. */
export async function setPoints(programId: number | string, points: number): Promise<void> {
  const { error } = await sb()
    .from("user_points")
    .upsert(
      { user_id: DEMO, program_id: programId, points, as_of: new Date().toISOString() },
      { onConflict: "user_id,program_id" }
    );
  if (error) throw new Error(`pub.setPoints: ${error.message}`);
}

/** Add a wishlist item (aspirational redemption). */
export async function addWish(
  title: string,
  programId: number | string | null,
  pointsRequired: number | null,
  notes?: string
): Promise<void> {
  const { error } = await sb()
    .from("wishlist_items")
    .insert({
      user_id: DEMO,
      title,
      program_id: programId,
      points_required: pointsRequired,
      notes: notes || null,
      created_at: new Date().toISOString(),
    });
  if (error) throw new Error(`pub.addWish: ${error.message}`);
}

/** Place a redemption order against a points balance. */
export async function order(
  programId: number | string,
  itemTitle: string,
  pointsCost: number,
  details?: Record<string, any>
): Promise<void> {
  const { error } = await sb()
    .from("redemption_orders")
    .insert({
      user_id: DEMO,
      program_id: programId,
      item_title: itemTitle,
      points_cost: pointsCost,
      status: "pending",
      details: details || null,
      created_at: new Date().toISOString(),
    });
  if (error) throw new Error(`pub.order: ${error.message}`);
}
