import { Resend } from "resend";
import type { Mailer } from "../../application";

interface EmailTemplate {
  subject: string;
  html: string;
}

const TEMPLATES: Record<string, (data: Record<string, unknown>) => EmailTemplate> = {
  "password-reset": (data) => ({
    subject: "Restablece tu contraseña",
    html: `<p>Solicitaste restablecer tu contraseña.</p><p><a href="${data.url}">Haz clic aquí para continuar</a></p><p>Si no fuiste tú, ignora este correo.</p>`,
  }),
};

export class ResendMailer implements Mailer {
  private client?: Resend;

  constructor(private readonly apiKey: string) {}

  // El SDK de Resend valida la API key en su propio constructor — se instancia
  // perezosamente para que importar este módulo sin credenciales configuradas
  // (build, tests, entornos sin RESEND_API_KEY) no falle hasta el primer envío real.
  private getClient(): Resend {
    if (!this.client) {
      this.client = new Resend(this.apiKey);
    }
    return this.client;
  }

  async send(input: { to: string; template: string; data: Record<string, unknown> }): Promise<void> {
    const template = TEMPLATES[input.template];
    if (!template) {
      throw new Error(`ResendMailer.send: plantilla desconocida "${input.template}"`);
    }
    const { subject, html } = template(input.data);
    await this.getClient().emails.send({
      from: process.env.EMAIL_FROM ?? "no-reply@empresas-antonio.com",
      to: input.to,
      subject,
      html,
    });
  }
}
