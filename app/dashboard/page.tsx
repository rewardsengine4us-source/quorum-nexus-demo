"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mine, all } from "@/lib/pub";

interface ProgramBalance {
  programId: string;
  programName: string;
  points: number;
  asOf: string | null;
}

export default function DashboardPage() {
  const [balances, setBalances] = useState<ProgramBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [points, programs] = await Promise.all([
          mine("user_points"),
          all("loyalty_programs"),
        ]);
        const programMap: Record<string, string> = {};
        for (const p of programs) programMap[String(p.id)] = p.program_name;

        const agg: Record<string, ProgramBalance> = {};
        for (const row of points) {
          const pid = String(row.program_id);
          if (!agg[pid]) {
            agg[pid] = {
              programId: pid,
              programName: programMap[pid] || `Program #${pid}`,
              points: 0,
              asOf: row.as_of || null,
            };
          }
          agg[pid].points += Number(row.points) || 0;
          if (row.as_of && (!agg[pid].asOf || row.as_of > agg[pid].asOf!)) {
            agg[pid].asOf = row.as_of;
          }
        }

        setBalances(Object.values(agg).sort((a, b) => b.points - a.points));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPoints = balances.reduce((sum, b) => sum + b.points, 0);

  return (
    <div className="min-h-screen bg-base-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Quorum Nexus</h1>
            <p className="text-slate-400 text-sm mt-1">Dashboard</p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/cards" className="text-slate-300 hover:text-white">Cards</Link>
            <Link href="/redeem" className="text-slate-300 hover:text-white">Redeem</Link>
            <Link href="/wishlist" className="text-slate-300 hover:text-white">Wishlist</Link>
            <Link href="/routes" className="text-slate-300 hover:text-white">Routes</Link>
            <Link href="/email-settings" className="text-slate-300 hover:text-white">Email Settings</Link>
          </nav>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 mb-8">
          <p className="text-slate-400 text-sm">Total points across all programs</p>
          <p className="text-4xl font-bold mt-2">{totalPoints.toLocaleString()}</p>
        </div>

        {loading && <p className="text-slate-500">Loading balances...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.length === 0 && (
              <p className="text-slate-500 col-span-full">
                No points found yet. Connect Gmail in Email Settings to sync balances.
              </p>
            )}
            {balances.map((b) => (
              <div
                key={b.programId}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
              >
                <p className="text-sm text-slate-400">{b.programName}</p>
                <p className="text-2xl font-semibold mt-1">{b.points.toLocaleString()}</p>
                {b.asOf && (
                  <p className="text-xs text-slate-600 mt-1">
                    as of {new Date(b.asOf).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
