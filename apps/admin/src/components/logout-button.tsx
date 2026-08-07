"use client";

import { useRouter } from "next/navigation";
import { adminAuthClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="text-sm underline"
      onClick={async () => {
        await adminAuthClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Cerrar sesión
    </button>
  );
}
