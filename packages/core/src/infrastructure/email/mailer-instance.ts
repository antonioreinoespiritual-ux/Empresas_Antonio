import { ResendMailer } from "./resend-mailer";

export const mailer = new ResendMailer(process.env.RESEND_API_KEY ?? "");
