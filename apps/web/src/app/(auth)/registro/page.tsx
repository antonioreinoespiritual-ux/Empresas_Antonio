"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const { error } = await authClient.signUp.email(values);
    if (error) {
      setError("root", { message: error.message ?? "No se pudo crear la cuenta" });
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium">Nombre</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="text" {...register("name")} />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Contraseña</label>
          <input className="mt-1 w-full rounded border px-3 py-2" type="password" {...register("password")} />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        </div>
        {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
        <button
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          Crear cuenta
        </button>
      </form>
    </main>
  );
}
