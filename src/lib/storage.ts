import { doc,getDoc } from "firebase/firestore";
import { getDownloadURL,ref,uploadBytesResumable } from "firebase/storage";
import { auth,db,storage } from "./firebase";

export const uploadFileToStorage = async (
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) throw new Error("Adjunta un JPG, PNG, WebP o PDF de hasta 5 MB.");
  const user = auth.currentUser;
  if (!user) throw new Error("Sesión inválida");
  const profile = await getDoc(doc(db, "usuarios", user.uid));
  const empresaId = profile.data()?.empresaId;
  if (!empresaId) throw new Error("Empresa no disponible");
  const tenantPath = path.startsWith(`empresas/${empresaId}/`) ? path : `empresas/${empresaId}/${path}`;
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, tenantPath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};
