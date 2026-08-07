import { Resend } from "resend";
import type { Mailer } from "../../application";

export class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(_input: { to: string; template: string; data: Record<string, unknown> }): Promise<void> {
    throw new Error("ResendMailer.send: pendiente de Fase 1 (definir plantillas transaccionales)");
  }
}
