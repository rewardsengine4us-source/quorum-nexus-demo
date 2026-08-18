import { NextResponse, NextRequest } from "next/server";
import { google } from "googleapis";
import { DEMO, del, ins } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(appUrl + "/email-settings");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    appUrl + "/api/auth/gmail/callback"
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let email = "";
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const info = await oauth2.userinfo.get();
      email = info.data.email || "";
    } catch (e) {
      email = "";
    }

    await del("email_connections", `user_id=eq.${DEMO}&oauth_provider=eq.gmail`);

    await ins("email_connections", [
      {
        user_id: DEMO,
        email,
        oauth_provider: "gmail",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    // fall through to redirect regardless; email-settings will show disconnected state
  }

  return NextResponse.redirect(appUrl + "/email-settings");
}
