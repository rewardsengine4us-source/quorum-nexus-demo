"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { mine, all, delRow } from "@/lib/pub";

interface LinkedCard {
  userCardId: string | number;
  creditCardId: string | number;
  cardName: string;
  bankName: string;
  notes: string | null;
}

export default function CardsPage() {
  const [cards, setCards] = useState<LinkedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userCards, creditCards, banks] = await Promise.all([
        mine("user_cards"),
        all("credit_cards"),
        all("banks"),
      ]);
      const cardMap: Record<string, any> = {};
      for (const c of creditCards) cardMap[String(c.id)] = c;
      const bankMap: Record<string, string> = {};
      for (const b of banks) bankMap[String(b.id)] = b.bank_name;

      const rows: LinkedCard[] = userCards.map((uc: any) => {
        const card = cardMap[String(uc.credit_card_id)] || {};
        return {
          userCardId: uc.id ?? uc.credit_card_id,
          creditCardId: uc.credit_card_id,
          cardName: card.card_name || `Card #${uc.credit_card_id}`,
          bankName: bankMap[String(card.bank_id)] || "",
          notes: uc.notes || null,
        };
      });
      setCards(rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove(id: string | number) {
    setRemoving(id);
    try {
      await delRow("user_cards", id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="min-h-screen bg-base-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Quorum Nexus</h1>
            <p className="text-slate-400 text-sm mt-1">Your Cards</p>
          </div>
          <Link href="/dashboard" className="text-slate-300 hover:text-white text-sm">
            Back to Dashboard
          </Link>
        </div>

        {loading && <p className="text-slate-500">Loading cards...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.length === 0 && (
              <p className="text-slate-500 col-span-full">
                No cards linked yet. Cards are auto-detected from your inbox during email sync.
              </p>
            )}
            {cards.map((c) => (
              <div
                key={String(c.userCardId)}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 flex items-start justify-between"
              >
                <div>
                  <p className="font-medium">{c.cardName}</p>
                  <p className="text-sm text-slate-400">{c.bankName}</p>
                  {c.notes && <p className="text-xs text-slate-600 mt-2">{c.notes}</p>}
                </div>
                <button
                  onClick={() => handleRemove(c.userCardId)}
                  disabled={removing === c.userCardId}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {removing === c.userCardId ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
