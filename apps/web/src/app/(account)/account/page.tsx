import { headers } from "next/headers";
import { userAuth } from "@repo/core/infrastructure";
import { Heading, Text } from "@repo/ui/primitives";

export default async function AccountPage() {
  const session = await userAuth.api.getSession({ headers: headers() });

  return (
    <main className="py-8">
      <Heading as="h1">Mi cuenta</Heading>
      <Text tone="muted" className="mt-4">
        Sesión activa como {session?.user.email}.
      </Text>
    </main>
  );
}
