import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { userAuth } from "@repo/core/infrastructure";
import { LogoutButton } from "@/components/logout-button";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await userAuth.api.getSession({ headers: headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="flex items-center justify-between border-b py-4 text-sm text-neutral-600">
        <span>{session.user.email}</span>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
