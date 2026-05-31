import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { empresaId, cedula } = await request.json();

    if (!empresaId || !cedula) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    const clientesRef = adminDb.collection("clientes");
    const q = clientesRef
      .where("empresaId", "==", empresaId)
      .where("cedula", "==", cedula)
      .limit(1);

    const snapshot = await q.get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No se encontró ningún cliente con esta cédula" }, { status: 404 });
    }

    const clienteId = snapshot.docs[0].id;

    return NextResponse.json({ clienteId });
  } catch (error: any) {
    console.error("Portal login error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
