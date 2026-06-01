import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { adminDb } from "../src/lib/firebase-admin";

async function check() {
  const snap = await adminDb.collection("prestamos").get();
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.monto === 100 || d.totalPagar === 126 || d.totalPagar === 252) {
      console.log(`ID: ${doc.id}`);
      console.log(`Cliente: ${d.clienteNombre}`);
      console.log(`Monto: ${d.monto}, Tasa: ${d.tasaInteres}, Freq: ${d.frecuenciaPago}, Cuotas: ${d.numeroCuotas}`);
      console.log(`PeriodoTasa: ${d.periodoTasa}, Tipo: ${d.tipoInteres}`);
      console.log(`Total Pagar: ${d.totalPagar}, Total Interes: ${d.totalInteres}`);
      console.log("-------------------");
    }
  });
}
check();
