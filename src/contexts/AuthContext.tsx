"use client";
import { auth,db } from "@/lib/firebase";
import type { Usuario } from "@/types";
import { onAuthStateChanged,User } from "firebase/auth";
import { doc,onSnapshot } from "firebase/firestore";
import { createContext,useContext,useEffect,useState } from "react";
interface AuthContextType { user: User | null; userData: Usuario | null; loading: boolean; error: string | null }
const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true, error: null });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthContextType>({ user: null, userData: null, loading: true, error: null });
  useEffect(() => {
    let stopProfile = () => {};
    const stopAuth = onAuthStateChanged(auth, currentUser => {
      stopProfile();
      if (!currentUser) { setState({ user: null, userData: null, loading: false, error: null }); return; }
      setState({ user: currentUser, userData: null, loading: true, error: null });
      stopProfile = onSnapshot(doc(db, "usuarios", currentUser.uid), snap => {
        const data = snap.data();
        if (!data || (data.activo !== undefined && data.activo !== true)) {
          setState({ user: currentUser, userData: null, loading: false, error: "Tu perfil no está habilitado. Contacta al administrador." });
          return;
        }
        setState({ user: currentUser, userData: { ...data, uid: currentUser.uid } as Usuario, loading: false, error: null });
      }, () => setState({ user: currentUser, userData: null, loading: false, error: "No se pudo validar tu perfil. Vuelve a iniciar sesión." }));
    });
    return () => { stopAuth(); stopProfile(); };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
