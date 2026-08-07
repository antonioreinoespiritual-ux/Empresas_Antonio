import { headers } from "next/headers";
import { userAuth } from "@repo/core/infrastructure";

export default async function AccountPage() {
  const session = await userAuth.api.getSession({ headers: headers() });

  return (
    <main className="py-8">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>
      <p className="mt-4 text-neutral-600">Sesión activa como {session?.user.email}.</p>
    </main>
  );
}
