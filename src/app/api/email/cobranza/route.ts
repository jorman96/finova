import { idSchema } from "@/lib/finance-schema";
import { sendNotification } from "@/lib/notification-service";
import { collectors } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { apiError,requireActor } from "@/lib/server-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request, collectors);
    await rateLimit("email:" + actor.uid, 30, 60_000);
    const { cuotaId } = z.object({ cuotaId: idSchema }).parse(await request.json());
    return NextResponse.json(await sendNotification(actor.empresaId, "cobranza", cuotaId));
  } catch (error) { return apiError(error); }
}
