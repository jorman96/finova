'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { businessDate } from '@/lib/business-date';
type Company = { nombre?: string; zonaHoraria?: string };
export function useCompany() {
  const { userData } = useAuth();
  const id = userData?.empresaId;
  const [stored, setStored] = useState<{ id: string; company: Company } | null>(null);
  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'empresas', id), snap => setStored({ id, company: snap.data() || {} }), () => setStored(null));
  }, [id]);
  return stored && stored.id === id ? stored.company : null;
}
export function useBusinessDay(timeZone?: string) {
  const [instant, setInstant] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setInstant(new Date()), 60000); return () => window.clearInterval(id); }, []);
  return businessDate(instant, timeZone);
}
