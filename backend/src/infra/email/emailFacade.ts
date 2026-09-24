import nodemailer, { type Transporter } from 'nodemailer';
import { AppError } from '../../errors.js';
import { getSetting } from '../settingsProvider.js';

// Criado sob demanda (não no boot) — assim a API sobe normalmente mesmo antes
// do Gmail estar configurado em Admin → Integrações; só o envio de e-mail fica
// indisponível até lá.
let cached: { transporter: Transporter; from: string } | null = null;

async function client(): Promise<{ transporter: Transporter; from: string }> {
  const user = await getSetting('Email:GmailUser');
  const appPassword = await getSetting('Email:GmailAppToken');
  if (!user || !appPassword)
    throw new AppError('E-mail não configurado (defina a conta Gmail em Admin → Integrações).', 503);

  if (cached?.from === user) return cached;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: appPassword },
  });
  cached = { transporter, from: user };
  return cached;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { transporter, from } = await client();
  const fromName = (await getSetting('Email:FromName')) ?? 'OpenDriverHub';
  await transporter.sendMail({ from: `"${fromName}" <${from}>`, to, subject, html });
}
