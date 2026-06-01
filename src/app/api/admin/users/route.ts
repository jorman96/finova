import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Verify Authentication of the caller (Super Admin check)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check if the caller is superadmin by checking Firestore (or custom claims)
    const callerDoc = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    const callerData = callerDoc.data();
    const { email, password, nombre, documento, telefono, empresaId, rol } = await request.json();

    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Permisos insuficientes.' }, { status: 403 });
    }

    const isSuperAdmin = callerData?.rol === 'superadmin';
    const isDueño = callerData?.rol === 'dueño';

    if (!isSuperAdmin && !isDueño) {
      return NextResponse.json({ error: 'Permisos insuficientes.' }, { status: 403 });
    }

    if (isDueño && callerData?.empresaId !== empresaId) {
      return NextResponse.json({ error: 'No puedes crear usuarios para otra empresa.' }, { status: 403 });
    }

    if (!email || !password || !empresaId) {
      return NextResponse.json({ error: 'Faltan datos requeridos (email, password, empresaId).' }, { status: 400 });
    }

    // 3. Verify if empresa exists and is active
    const empresaDoc = await adminDb.collection('empresas').doc(empresaId).get();
    if (!empresaDoc.exists) {
       return NextResponse.json({ error: 'La empresa especificada no existe.' }, { status: 404 });
    }

    // 4. Create User in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
    });

    // 5. Save user profile in Firestore
    await adminDb.collection('usuarios').doc(userRecord.uid).set({
      email,
      nombre,
      documento: documento || '',
      telefono: telefono || '',
      empresaId,
      rol: rol || 'dueño',
      createdAt: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Usuario creado exitosamente', 
      uid: userRecord.uid 
    });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
