import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { userAuth } from "@repo/core/infrastructure";
import { DEFAULT_THEME_ID } from "@repo/core/domain";
import { getTheme } from "@repo/ui/themes";
import { ThemeProvider, Container } from "@repo/ui/primitives";
import { LogoutButton } from "@/components/logout-button";

// /account no pertenece a una Offer — no hay landing de la que "heredar" el
// theme — así que usa el theme por defecto del sistema en vez de inventar un
// concepto nuevo de "theme de usuario". El objetivo de B5 es que esta zona
// deje de verse cruda, no acoplarla a una compra en particular.
const theme = getTheme(DEFAULT_THEME_ID);

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await userAuth.api.getSession({ headers: headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <ThemeProvider theme={theme} className="min-h-screen bg-background">
      <Container width="content">
        <header className="flex items-center justify-between border-b border-border py-4 text-sm text-foreground-muted">
          <span>{session.user.email}</span>
          <LogoutButton />
        </header>
        {children}
      </Container>
    </ThemeProvider>
  );
}
