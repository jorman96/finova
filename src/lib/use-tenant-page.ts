"use client";
import { collection,getDocs,limit,orderBy,query,startAfter,where,type DocumentData,type QueryConstraint,type QueryDocumentSnapshot } from "firebase/firestore";
import { useState } from "react";
import { db } from "./firebase";
import { useResource } from "./use-resource";
export function useTenantPage<T>(name: string, empresaId: string | undefined, sort = "createdAt") {
  const [state, setState] = useState<{ scope?: string; cursors: (QueryDocumentSnapshot<DocumentData> | null)[]; page: number }>({ scope: empresaId, cursors: [null], page: 0 });
  const paging = state.scope === empresaId ? state : { scope: empresaId, cursors: [null], page: 0 };
  const [revision, setRevision] = useState(0);
  const result = useResource<{ rows: T[]; last: QueryDocumentSnapshot<DocumentData> | null; hasNext: boolean }>(JSON.stringify([name,empresaId,sort,paging.cursors[paging.page]?.id,revision]), async () => {
    if (!empresaId) return { rows: [], last: null, hasNext: false };
    const constraints: QueryConstraint[] = [where("empresaId", "==", empresaId), orderBy(sort, "desc"), limit(51)];
    if (paging.cursors[paging.page]) constraints.push(startAfter(paging.cursors[paging.page]));
    const snap = await getDocs(query(collection(db, name), ...constraints));
    const docs = snap.docs.slice(0, 50);
    return { rows: docs.map(d => ({ ...d.data(), id: d.id } as T)), last: docs.at(-1) || null, hasNext: snap.size > 50 };
  });
  return {
    rows: result.data?.rows || [], loading: result.loading, error: result.error, page: paging.page, hasNext: result.data?.hasNext || false,
    refresh: () => setRevision(n => n + 1),
    next: () => { const last = result.data?.last; if (last && result.data?.hasNext) setState({ scope: empresaId, cursors: [...paging.cursors.slice(0,paging.page + 1),last], page: paging.page + 1 }); },
    previous: () => setState({ ...paging, page: Math.max(0,paging.page - 1) }),
  };
}

