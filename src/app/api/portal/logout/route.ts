import { adminDb } from "@/lib/firebase-admin";
import { hashToken,PORTAL_COOKIE } from "@/lib/portal-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
export async function POST() {
  const jar = await cookies(), token = jar.get(PORTAL_COOKIE)?.value;
  if (token) await adminDb.collection("portal_sessions").doc(hashToken(token)).delete();
  jar.delete(PORTAL_COOKIE);
  return NextResponse.json({ success: true });
}
