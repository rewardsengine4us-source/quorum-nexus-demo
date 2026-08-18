"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { mine, all, order } from "@/lib/pub";

interface Voucher {
  id: string | number;
  title: string;
  program_id: string | number;
  points_cost: number;
  category?: string;
}

export default function RedeemPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [programMap, setProgramMap] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, programs, points] = await Promise.all([
        all("redemption_catalog"),
        all("loyalty_programs"),
        mine("user_points"),
      ]);

      const pMap: Record<string, string> = {};
      for (const p of programs) pMap[String(p.id)] = p.program_name;
      setProgramMap(pMap);

      const bal: Record<string, number> = {};
      for (const row of points) {
        bal[String(row.program_id)] = (bal[String(row.program_id)] || 0) + Number(row.points || 0);
      }
      setBalances(bal);

      setVouchers(items as Voucher[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRedeem(v: Voucher) {
    setRedeeming(v.id);
    setMessage(null);
    try {
      await order(v.program_id, v.title, v.points_cost);
      setMessage(`Redeemed: ${v.title}`);
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setRedeeming(null);
    }
  }

  return (
    <div className="min-h-screen bg-base-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Quorum Nexus</h1>
            <p className="text-slate-400 text-sm mt-1">Redeem</p>
          </div>
          <Link href="/dashboard" className="text-slate-300 hover:text-white text-sm">
            Back to Dashboard
          </Link>
        </div>

        {message && (
          <div className="rounded-md border border-indigo-800 bg-indigo-900/30 px-4 py-2 text-sm mb-6">
            {message}
          </div>
        )}

        {loading && <p className="text-slate-500">Loading redemption catalog...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vouchers.length === 0 && (
              <p className="text-slate-500 col-span-full">
                No redemption catalog items available yet.
              </p>
            )}
            {vouchers.map((v) => {
              const have = balances[String(v.program_id)] || 0;
              const affordable = have >= v.points_cost;
              return (
                <div
                  key={String(v.id)}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between"
                >
                  <div>
                    <p className="font-medium">{v.title}</p>
                    <p className="text-sm text-slate-400">
                      {programMap[String(v.program_id)] || `Program #${v.program_id}`}
                    </p>
                    <p className="text-lg font-semibold mt-2">
                      {v.points_cost.toLocaleString()} pts
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      You have {have.toLocaleString()} pts
                    </p>
                  </div>
                  <button
                    onClick={() => handleRedeem(v)}
                    disabled={!affordable || redeeming === v.id}
                    className="mt-4 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium transition-colors"
                  >
                    {redeeming === v.id ? "Redeeming..." : affordable ? "Redeem" : "Not enough points"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
