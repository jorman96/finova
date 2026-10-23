import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { apiError, requireActor } from "@/lib/server-auth";
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const user = await adminAuth.getUser(actor.uid);
    const config = process.env.FIREBASE_AUTH_EMULATOR_HOST ? null : await adminAuth.projectConfigManager().getProjectConfig();
    const available = config?.multiFactorConfig?.providerConfigs?.some(p => p.state === "ENABLED" && p.totpProviderConfig) || false;
    return NextResponse.json({ available, enrolled: !!user.multiFactor?.enrolledFactors?.length, emailVerified: user.emailVerified }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
