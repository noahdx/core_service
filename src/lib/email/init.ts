import { MailjetProvider } from '../../pkg/email/mailjet';
import { env } from '../config/env';

export const emailProvider = new MailjetProvider({
  apiKey: env.mailjet.apiKey,
  secretKey: env.mailjet.secretKey,
  fromEmail: env.mailjet.fromEmail,
  fromName: env.mailjet.fromName,
});
