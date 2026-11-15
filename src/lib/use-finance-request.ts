"use client";
import { useRef } from "react";
import { apiPost } from "./api-client";
export function useFinanceRequest() {
  const pending = useRef<string | null>(null);
  return {
    reset: () => { pending.current = null; },
    submit: async (body: object) => {
      // Keep the same key after a network failure, even when an attachment is uploaded again.
      // A conflicting retry is rejected by the server instead of creating a second movement.
      if (!pending.current) pending.current = crypto.randomUUID();
      return apiPost<{ success: boolean; id: string }>("/api/finance", { ...body, requestId: pending.current });
    },
  };
}
