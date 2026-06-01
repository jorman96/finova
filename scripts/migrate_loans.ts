import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { adminDb } from "../src/lib/firebase-admin";
import { generateAmortizationTable, AmortizationInput } from "../src/lib/amortization";

async function migrateLoans() {
  console.log("Iniciando migración de préstamos...");
  try {
    const prestamosSnap = await adminDb.collection("prestamos").get();
    
    let actualizados = 0;
    let omitidosPorPagos = 0;
    let omitidosPorYaMigrados = 0;

    for (const doc of prestamosSnap.docs) {
      const data = doc.data() as any;
      
      // Si ya tiene periodoTasa, asumimos que fue creado después del parche
      if (data.periodoTasa) {
        omitidosPorYaMigrados++;
        continue;
      }

      console.log(`\nRevisando préstamo: ${doc.id} (Cliente: ${data.clienteNombre})`);

      // Verificar cuotas pagadas
      const cuotasSnap = await adminDb.collection("cuotas")
        .where("prestamoId", "==", doc.id)
        .get();

      let tienePagos = false;
      for (const cuota of cuotasSnap.docs) {
        const cData = cuota.data();
        if ((cData.montoPagado && cData.montoPagado > 0) || cData.estado !== 'pendiente') {
          tienePagos = true;
          break;
        }
      }

      if (tienePagos) {
        console.log(`⚠️ Préstamo ${doc.id} OMITIDO: Ya tiene pagos registrados.`);
        omitidosPorPagos++;
        continue;
      }

      console.log(`🔄 Recalculando préstamo ${doc.id}...`);

      // Eliminar cuotas viejas
      const batchDelete = adminDb.batch();
      cuotasSnap.docs.forEach((cuotaDoc) => {
        batchDelete.delete(cuotaDoc.ref);
      });
      await batchDelete.commit();

      // Generar nueva tabla asumiendo periodoTasa = 'mensual'
      const input: AmortizationInput = {
        monto: data.monto,
        tasaInteres: data.tasaInteres,
        periodoTasa: 'mensual',
        tipoInteres: data.tipoInteres,
        frecuenciaPago: data.frecuenciaPago,
        numeroCuotas: data.numeroCuotas,
        fechaPrimerPago: data.fechaPrimerPago
      };

      const simulacion = generateAmortizationTable(input);
      const totalInteres = simulacion.reduce((acc, c) => acc + c.interes, 0);
      const totalPagar = simulacion.reduce((acc, c) => acc + c.totalCuota, 0);

      // Guardar nuevo préstamo y cuotas en Batch
      const batchCreate = adminDb.batch();
      
      // Actualizar documento del préstamo
      batchCreate.update(doc.ref, {
        periodoTasa: 'mensual',
        totalInteres,
        totalPagar,
        saldoRestante: totalPagar
      });

      // Crear nuevas cuotas
      simulacion.forEach(cuota => {
        const cuotaRef = adminDb.collection("cuotas").doc();
        batchCreate.set(cuotaRef, {
          prestamoId: doc.id,
          empresaId: data.empresaId,
          clienteId: data.clienteId,
          numeroCuota: cuota.numeroCuota,
          fechaVencimiento: cuota.fechaVencimiento,
          capital: cuota.capital,
          interes: cuota.interes,
          totalCuota: cuota.totalCuota,
          saldoPendiente: cuota.saldoPendiente,
          estado: 'pendiente',
          montoPagado: 0,
        });
      });

      await batchCreate.commit();
      console.log(`✅ Préstamo ${doc.id} migrado correctamente.`);
      actualizados++;
    }

    console.log("\n==================================");
    console.log("RESUMEN DE MIGRACIÓN");
    console.log("==================================");
    console.log(`Total analizados: ${prestamosSnap.size}`);
    console.log(`Actualizados con éxito: ${actualizados}`);
    console.log(`Omitidos (ya tenían pagos): ${omitidosPorPagos}`);
    console.log(`Omitidos (ya estaban migrados): ${omitidosPorYaMigrados}`);

  } catch (error) {
    console.error("Error durante la migración:", error);
  }
}

migrateLoans();
