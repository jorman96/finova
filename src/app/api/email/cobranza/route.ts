import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActor, apiError } from "@/lib/server-auth";
import { collectors } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { sendNotification } from "@/lib/notification-service";
export async function POST(request: Request) {
 try {
  const actor = await requireActor(request, collectors);
  await rateLimit("email:" + actor.uid, 30, 60_000);
  const data = z.object({ cuotaId: z.string().min(1).max(200).regex(/^[^/]+$/) }).parse(await request.json());
  return NextResponse.json(await sendNotification(actor.empresaId, "cobranza", data.cuotaId));
 } catch (error) { return apiError(error); }
}
