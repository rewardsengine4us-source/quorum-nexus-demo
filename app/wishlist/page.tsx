"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { mine, all, addWish, delRow } from "@/lib/pub";

interface WishItem {
  id: string | number;
  title: string;
  program_id: string | number | null;
  points_required: number | null;
  notes: string | null;
  created_at: string;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishItem[]>([]);
  const [programs, setPrograms] = useState<Record<string, string>>({});
  const [programList, setProgramList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [programId, setProgramId] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wish, progs] = await Promise.all([
        mine("wishlist_items"),
        all("loyalty_programs"),
      ]);
      const pMap: Record<string, string> = {};
      for (const p of progs) pMap[String(p.id)] = p.program_name;
      setPrograms(pMap);
      setProgramList(progs);
      setItems(wish as WishItem[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addWish(
        title.trim(),
        programId || null,
        pointsRequired ? parseInt(pointsRequired, 10) : null,
        notes.trim() || undefined
      );
      setTitle("");
      setProgramId("");
      setPointsRequired("");
      setNotes("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string | number) {
    try {
      await delRow("wishlist_items", id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-base-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Quorum Nexus</h1>
            <p className="text-slate-400 text-sm mt-1">Wishlist</p>
          </div>
          <Link href="/dashboard" className="text-slate-300 hover:text-white text-sm">
            Back to Dashboard
          </Link>
        </div>

        <form
          onSubmit={handleAdd}
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 mb-8 grid grid-cols-1 sm:grid-cols-5 gap-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to redeem?"
            className="sm:col-span-2 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            required
          />
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="">Any program</option>
            {programList.map((p) => (
              <option key={String(p.id)} value={p.id}>
                {p.program_name}
              </option>
            ))}
          </select>
          <input
            value={pointsRequired}
            onChange={(e) => setPointsRequired(e.target.value)}
            placeholder="Points needed"
            type="number"
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 text-sm font-medium"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </form>

        {loading && <p className="text-slate-500">Loading wishlist...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.length === 0 && (
              <p className="text-slate-500 col-span-full">Your wishlist is empty.</p>
            )}
            {items.map((it) => (
              <div
                key={String(it.id)}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 flex items-start justify-between"
              >
                <div>
                  <p className="font-medium">{it.title}</p>
                  {it.program_id && (
                    <p className="text-sm text-slate-400">
                      {programs[String(it.program_id)] || `Program #${it.program_id}`}
                    </p>
                  )}
                  {it.points_required && (
                    <p className="text-xs text-slate-600 mt-1">
                      {it.points_required.toLocaleString()} pts needed
                    </p>
                  )}
                  {it.notes && <p className="text-xs text-slate-600 mt-1">{it.notes}</p>}
                </div>
                <button
                  onClick={() => handleRemove(it.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
