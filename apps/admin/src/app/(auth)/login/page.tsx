"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card, Field, Input } from "@repo/admin-ui/primitives";
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
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" invalid={!!errors.password} {...register("password")} />
        </Field>
        {errors.root && <p className="text-sm text-danger">{errors.root.message}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          Entrar
        </Button>
      </form>
    </Card>
  );
}
