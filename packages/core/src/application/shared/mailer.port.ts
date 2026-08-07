export interface Mailer {
  send(input: { to: string; template: string; data: Record<string, unknown> }): Promise<void>;
}
