"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

import { Usuario } from "@/types";

interface AuthContextType {
  user: User | null;
  userData: Usuario | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, "usuarios", currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Migración automática para la cuenta original creada antes del modo SaaS
            if (!data.empresaId || data.rol === "admin") {
              const migratedUser = { 
                ...data, 
                rol: "superadmin", 
                empresaId: "default_empresa_1" 
              };
              const { setDoc } = await import("firebase/firestore");
              await setDoc(userRef, migratedUser, { merge: true });
              setUserData(migratedUser as Usuario);
            } else {
              setUserData(data as Usuario);
            }
          } else {
            // Create user document automatically if it doesn't exist
            const newUser: Usuario = {
              uid: currentUser.uid,
              nombre: currentUser.displayName || currentUser.email?.split('@')[0] || "Usuario",
              email: currentUser.email || "",
              rol: "superadmin", // First user is superadmin
              empresaId: "default_empresa_1", // Default tenant ID
              activo: true,
              createdAt: new Date().toISOString()
            };
            
            // Need to import setDoc from firebase/firestore
            const { setDoc } = await import("firebase/firestore");
            await setDoc(userRef, newUser);
            
            setUserData(newUser);
          }
        } catch (error) {
          console.error("Error fetching/creating user data:", error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
