"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white">
      <h1 className="text-4xl font-bold mb-4">Quorum Nexus</h1>
      <p className="text-white/80">Redirecting to dashboard...</p>
    </div>
  );
}
