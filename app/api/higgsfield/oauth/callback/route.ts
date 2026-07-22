import { fetchAction } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const back = new URL("/admin/settings", url.origin);

  if (error) {
    back.searchParams.set("higgsfield", `error:${error}`);
    return NextResponse.redirect(back);
  }
  if (!code || !state) {
    back.searchParams.set("higgsfield", "missing-code-or-state");
    return NextResponse.redirect(back);
  }

  try {
    await fetchAction(api.higgsfieldOAuth.complete, { code, state });
    back.searchParams.set("higgsfield", "connected");
  } catch (err) {
    back.searchParams.set("higgsfield", `error:${err instanceof Error ? err.message : String(err)}`.slice(0, 180));
  }
  return NextResponse.redirect(back);
}
