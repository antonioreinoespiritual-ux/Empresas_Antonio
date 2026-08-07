"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

export default function RecoverPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    // Siempre respondemos con éxito genérico — Better Auth ya evita enumeración de usuarios.
    await authClient.requestPasswordReset({ email: values.email, redirectTo: "/restablecer" });
    setSent(true);
  }

  if (sent) {
    return (
      <main className="py-16">
        <h1 className="text-2xl font-semibold">Revisa tu correo</h1>
        <p className="mt-4 text-neutral-600">
          Si el email existe en nuestro sistema, te enviamos un enlace para restablecer tu contraseña.
        </p>
      </main>
    );
  }

  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>
        <button
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          Enviar enlace
        </button>
      </form>
    </main>
  );
}
