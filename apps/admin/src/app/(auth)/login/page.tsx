"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card } from "@repo/admin-ui/primitives";
import { adminAuthClient } from "@/lib/auth-client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const { error } = await adminAuthClient.signIn.email(values);
    if (error) {
      setError("root", { message: error.message ?? "No se pudo iniciar sesión" });
      return;
    }
    router.push("/orders");
    router.refresh();
  }

  return (
    <Card>
      <p className="text-sm font-bold tracking-tight text-ink">Empresas Antonio</p>
      <h1 className="mt-3 text-lg font-semibold text-ink">Acceso administradores</h1>
      <p className="mt-1 text-sm text-ink-muted">Sesión independiente de los usuarios finales.</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            {...register("email")}
          />
          {errors.email && <p className="mt-1 text-sm text-danger">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            {...register("password")}
          />
          {errors.password && <p className="mt-1 text-sm text-danger">{errors.password.message}</p>}
        </div>
        {errors.root && <p className="text-sm text-danger">{errors.root.message}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          Entrar
        </Button>
      </form>
    </Card>
  );
}
