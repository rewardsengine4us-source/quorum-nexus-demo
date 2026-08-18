"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { all } from "@/lib/pub";

interface TransferRoute {
  id: string | number;
  from_program_id: string | number;
  to_program_id: string | number;
  ratio_from: number;
  ratio_to: number;
  valuation_per_point?: number | null;
  notes?: string | null;
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<TransferRoute[]>([]);
  const [programs, setPrograms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rts, progs] = await Promise.all([
          all("transfer_routes"),
          all("loyalty_programs"),
        ]);
        const pMap: Record<string, string> = {};
        for (const p of progs) pMap[String(p.id)] = p.program_name;
        setPrograms(pMap);
        setRoutes(rts as TransferRoute[]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-base-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Quorum Nexus</h1>
            <p className="text-slate-400 text-sm mt-1">Transfer Routes</p>
          </div>
          <Link href="/dashboard" className="text-slate-300 hover:text-white text-sm">
            Back to Dashboard
          </Link>
        </div>

        {loading && <p className="text-slate-500">Loading transfer routes...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">From</th>
                  <th className="text-left px-4 py-2 font-medium">To</th>
                  <th className="text-left px-4 py-2 font-medium">Ratio</th>
                  <th className="text-left px-4 py-2 font-medium">Valuation</th>
                  <th className="text-left px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {routes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No transfer routes configured.
                    </td>
                  </tr>
                )}
                {routes.map((r) => (
                  <tr key={String(r.id)} className="border-t border-slate-800">
                    <td className="px-4 py-2">
                      {programs[String(r.from_program_id)] || `Program #${r.from_program_id}`}
                    </td>
                    <td className="px-4 py-2">
                      {programs[String(r.to_program_id)] || `Program #${r.to_program_id}`}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {r.ratio_from}:{r.ratio_to}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {r.valuation_per_point != null ? `₹${r.valuation_per_point}/pt` : "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{r.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
