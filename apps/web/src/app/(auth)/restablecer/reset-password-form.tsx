"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const schema = z.object({ newPassword: z.string().min(8) });
type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    if (!token) {
      setError("root", { message: "Enlace inválido o expirado" });
      return;
    }
    const { error } = await authClient.resetPassword({ newPassword: values.newPassword, token });
    if (error) {
      setError("root", { message: error.message ?? "No se pudo restablecer la contraseña" });
      return;
    }
    router.push("/login");
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="block text-sm font-medium">Nueva contraseña</label>
        <input className="mt-1 w-full rounded border px-3 py-2" type="password" {...register("newPassword")} />
        {errors.newPassword && <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>}
      </div>
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <button
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        type="submit"
        disabled={isSubmitting}
      >
        Guardar
      </button>
    </form>
  );
}
