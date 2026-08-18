"use client";

import { useEffect, useState, useCallback } from "react";

interface LogRow {
  id: number;
  email_id: string;
  email_subject: string;
  sender: string;
  extracted_points: number | null;
  extracted_balance: number | null;
  program_id: string | null;
  parse_status: string;
  detected_via: string | null;
  event_type: string | null;
  source: string | null;
  card_hint?: string | null;
  raw_email_snippet?: string | null;
  created_at: string;
}

interface Connection {
  id: number;
  email: string;
  oauth_provider: string;
  last_sync_at: string | null;
  created_at: string;
}

interface StatusResponse {
  connection: Connection | null;
  logs: LogRow[];
  programs: Record<string, string>;
  diag: { keyPresent: boolean; error: string | null };
}

export default function EmailSettingsPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/email/status", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (e) {
      // leave data as-is on transient fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/email/parse", { method: "POST" });
      const json = await res.json();
      setSyncResult(json);
    } catch (e) {
      setSyncResult({ error: (e as Error).message });
    } finally {
      setSyncing(false);
      await fetchStatus();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-950 text-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Loading Quorum Nexus...</p>
      </div>
    );
  }

  const connection = data?.connection || null;
  const logs = data?.logs || [];
  const programs = data?.programs || {};

  return (
    <div className="min-h-screen bg-base-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-1">Quorum Nexus</h1>
        <p className="text-slate-400 mb-8">Email Settings</p>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 mb-8">
          {connection ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-emerald-400 font-medium">
                  Connected: {connection.email}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Last sync:{" "}
                  {connection.last_sync_at
                    ? new Date(connection.last_sync_at).toLocaleString()
                    : "never"}
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium transition-colors"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <p className="text-sm text-slate-400">
                No Gmail account connected.
              </p>
              <a
                href="/api/auth/gmail"
                className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium transition-colors"
              >
                Connect Gmail
              </a>
            </div>
          )}

          {data?.diag && !data.diag.keyPresent && (
            <p className="mt-4 text-xs text-amber-400">
              Warning: SUPABASE_SERVICE_ROLE_KEY is not set on the server.
            </p>
          )}
          {data?.diag?.error && (
            <p className="mt-2 text-xs text-red-400">Diagnostic: {data.diag.error}</p>
          )}

          {syncResult && (
            <div className="mt-4 text-xs text-slate-400 border-t border-slate-800 pt-4">
              <p>
                Scanned {syncResult.scanned ?? 0}, processed {syncResult.processed ?? 0}, matched{" "}
                {syncResult.matched ?? 0}, unmatched {syncResult.unmatched ?? 0}, pdfs{" "}
                {syncResult.pdfs ?? 0}, cards linked {syncResult.cardsLinked ?? 0}, programs touched{" "}
                {syncResult.programsTouched ?? 0}
              </p>
              {syncResult.error && <p className="text-red-400 mt-1">{syncResult.error}</p>}
            </div>
          )}
        </div>

        <h2 className="text-lg font-medium mb-3">Parsed Emails</h2>
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Subject</th>
                <th className="text-left px-4 py-2 font-medium">Sender</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Balance</th>
                <th className="text-left px-4 py-2 font-medium">Detected Via</th>
                <th className="text-left px-4 py-2 font-medium">Event</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No emails parsed yet.
                  </td>
                </tr>
              )}
              {logs.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="px-4 py-2 max-w-xs truncate" title={row.email_subject}>
                    {row.email_subject || "(no subject)"}
                  </td>
                  <td className="px-4 py-2 max-w-xs truncate text-slate-400" title={row.sender}>
                    {row.sender}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        row.parse_status === "success"
                          ? "text-emerald-400"
                          : "text-slate-500"
                      }
                    >
                      {row.parse_status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {row.extracted_balance ?? "-"}
                    {row.program_id && programs[row.program_id]
                      ? ` ${programs[row.program_id]}`
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{row.detected_via || "-"}</td>
                  <td className="px-4 py-2 text-slate-400">{row.event_type || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
