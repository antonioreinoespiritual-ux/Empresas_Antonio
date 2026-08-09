"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/admin-ui/primitives";
import { adminAuthClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        await adminAuthClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Cerrar sesión
    </Button>
  );
}
