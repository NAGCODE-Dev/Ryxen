import nodemailer from 'nodemailer';
import 'dotenv/config';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'nagcode.contact@gmail.com';

let transportPromise = null;

export async function sendPasswordResetEmail({ to, code }) {
  const transport = await getTransport();
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || SUPPORT_EMAIL,
    to,
    subject: 'CrossApp - redefinicao de senha',
    text: [
      'Seu codigo de redefinicao de senha do CrossApp:',
      '',
      `Codigo: ${code}`,
      '',
      'Esse codigo expira em 15 minutos.',
      `Suporte: ${SUPPORT_EMAIL}`,
    ].join('\n'),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  return {
    messageId: info.messageId || null,
    previewUrl,
    transport: previewUrl ? 'ethereal' : detectTransportKind(),
  };
}

async function getTransport() {
  if (!transportPromise) {
    transportPromise = createTransport();
  }
  return transportPromise;
}

async function createTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

function detectTransportKind() {
  return process.env.SMTP_HOST ? 'smtp' : 'ethereal';
}
