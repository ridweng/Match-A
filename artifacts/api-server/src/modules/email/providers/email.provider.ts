import type { EmailPayload } from "../interfaces/email-payload.interface";
import type { EmailSendResult } from "../email.types";

export interface EmailProvider {
  readonly name: string;
  send(payload: EmailPayload): Promise<EmailSendResult>;
  verify?(): Promise<void>;
}
