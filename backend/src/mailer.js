import nodemailer from 'nodemailer';
import 'dotenv/config';

import { pool } from './db.js';
import { isDeveloperEmail, normalizeEmail } from './devAccess.js';
import { logOpsEvent } from './opsEvents.js';
import { EXPOSE_RESET_CODE } from './config.js';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'nagcode.contact@gmail.com';
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const RESEND_API_BASE_URL = String(process.env.RESEND_API_BASE_URL || 'https://api.resend.com').trim().replace(/\/$/, '');
const RESEND_FROM = String(process.env.RESEND_FROM || process.env.SMTP_FROM || SUPPORT_EMAIL).trim();
const MAILER_VERIFY_TIMEOUT_MS = Math.max(Number(process.env.MAILER_VERIFY_TIMEOUT_MS || 8000), 1000);
const MAILER_SEND_TIMEOUT_MS = Math.max(Number(process.env.MAILER_SEND_TIMEOUT_MS || 12000), 1000);
const SMTP_CONNECTION_TIMEOUT_MS = Math.max(Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 8000), 1000);
const SMTP_GREETING_TIMEOUT_MS = Math.max(Number(process.env.SMTP_GREETING_TIMEOUT_MS || 8000), 1000);
const SMTP_SOCKET_TIMEOUT_MS = Math.max(Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 12000), 1000);
const EMAIL_JOB_RETRY_DELAY_MS = Math.max(Number(process.env.EMAIL_JOB_RETRY_DELAY_MS || 15000), 1000);
const EMAIL_JOB_SWEEP_INTERVAL_MS = Math.max(Number(process.env.EMAIL_JOB_SWEEP_INTERVAL_MS || 30000), 5000);
const MAX_SWEEP_BATCH = 10;

let providerPromises = null;
let emailWorkerStarted = false;
let emailSweepTimer = null;

export async function sendPasswordResetEmail({ to, code, userId = null }) {
  return enqueuePasswordResetEmail({ to, code, userId });
}

export async function sendSignupVerificationEmail({ to, code }) {
  return enqueueCodeEmail({ kind: 'email_verification', to, code, userId: null });
}

export async function sendAccountDeletionReviewEmail({ to, userName = '', confirmUrl, cancelUrl, deleteAfter, supportEmail = SUPPORT_EMAIL }) {
  const email = normalizeEmail(to);
  if (!email) {
    const error = new Error('email inválido');
    error.code = 'invalid_email';
    throw error;
  }

  const inserted = await pool.query(
    `INSERT INTO email_jobs (user_id, kind, email, payload, status, next_attempt_at)
     VALUES (NULL, 'account_deletion_review', $1, $2, 'pending', NOW())
     RETURNING id`,
    [email, { userName, confirmUrl, cancelUrl, deleteAfter, supportEmail }],
  );

  return processEmailJob(inserted.rows[0].id, { immediate: true });
}

export async function getAuthCodeDeliveryCapability(email = '') {
  const providers = await getProviders();
  const hasInboxDelivery = providers.some((provider) => provider.kind === 'smtp' || provider.kind === 'resend');
  const developerPreview = !hasInboxDelivery && EXPOSE_RESET_CODE && isDeveloperEmail(email);

  return {
    mode: providers[0]?.kind || 'none',
    hasInboxDelivery,
    developerPreview,
    canSendCode: hasInboxDelivery || developerPreview,
  };
}

export async function enqueuePasswordResetEmail({ to, code, userId = null }) {
  return enqueueCodeEmail({ kind: 'password_reset', to, code, userId });
}

async function enqueueCodeEmail({ kind, to, code, userId = null }) {
  const email = normalizeEmail(to);
  if (!email) {
    const error = new Error('email inválido');
    error.code = 'invalid_email';
    throw error;
  }

  const inserted = await pool.query(
    `INSERT INTO email_jobs (user_id, kind, email, payload, status, next_attempt_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW())
     RETURNING id, user_id, kind, email, payload, status, provider, retry_count, max_retries,
               message_id, preview_url, last_error, next_attempt_at, sent_at, created_at, updated_at`,
    [userId || null, kind, email, { code }],
  );

  return processEmailJob(inserted.rows[0].id, { immediate: true });
}

export async function processEmailJob(jobId, { immediate = false } = {}) {
  const normalizedJobId = Number(jobId);
  if (!Number.isFinite(normalizedJobId) || normalizedJobId <= 0) {
    throw new Error('jobId inválido');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const jobRes = await client.query(
      `SELECT *
       FROM email_jobs
       WHERE id = $1
       FOR UPDATE`,
      [normalizedJobId],
    );
    const job = jobRes.rows[0] || null;
    if (!job) {
      await client.query('ROLLBACK');
      return null;
    }

    if (job.status === 'sent') {
      await client.query('COMMIT');
      return mapEmailJob(job);
    }

    const canAttemptNow = !job.next_attempt_at || new Date(job.next_attempt_at).getTime() <= Date.now();
    if (!immediate && !canAttemptNow) {
      await client.query('COMMIT');
      return mapEmailJob(job);
    }

    await client.query(
      `UPDATE email_jobs
       SET status = 'processing',
           updated_at = NOW()
       WHERE id = $1`,
      [normalizedJobId],
    );
    await client.query('COMMIT');

    const attempt = await attemptEmailDelivery(job);
    const nextRetryCount = Number(job.retry_count || 0) + (attempt.ok ? 0 : 1);
    const maxRetries = Number(job.max_retries || 2);
    const shouldRetry = !attempt.ok && nextRetryCount <= maxRetries;
    const nextAttemptAt = shouldRetry ? new Date(Date.now() + EMAIL_JOB_RETRY_DELAY_MS).toISOString() : null;

    const updatedRes = await pool.query(
      `UPDATE email_jobs
       SET status = $2,
           provider = $3,
           retry_count = $4,
           message_id = $5,
           preview_url = $6,
           last_error = $7,
           next_attempt_at = $8,
           sent_at = $9,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        normalizedJobId,
        attempt.ok ? 'sent' : 'failed',
        attempt.provider || null,
        nextRetryCount,
        attempt.messageId || null,
        attempt.previewUrl || null,
        attempt.error || null,
        nextAttemptAt,
        attempt.ok ? new Date().toISOString() : null,
      ],
    );

    const updatedJob = updatedRes.rows[0];

    await logOpsEvent({
      kind: 'email_job',
      status: attempt.ok ? 'sent' : (shouldRetry ? 'retry_scheduled' : 'failed'),
      userId: updatedJob.user_id,
      email: updatedJob.email,
      payload: {
        jobId: updatedJob.id,
        kind: updatedJob.kind,
        provider: attempt.provider || null,
        retryCount: updatedJob.retry_count,
        messageId: attempt.messageId || null,
        previewUrl: attempt.previewUrl || null,
        error: attempt.error || null,
        errorCode: attempt.errorCode || null,
        durationMs: attempt.durationMs || null,
      },
    });

    if (shouldRetry) {
      scheduleEmailJobRetry(updatedJob.id, EMAIL_JOB_RETRY_DELAY_MS);
    }

    if (!attempt.ok) {
      const error = new Error(attempt.error || 'Falha ao enviar email');
      error.code = attempt.errorCode || 'email_delivery_failed';
      error.job = mapEmailJob(updatedJob);
      throw error;
    }

    return {
      ...attempt,
      job: mapEmailJob(updatedJob),
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

export async function retryEmailJob(jobId) {
  return processEmailJob(jobId, { immediate: true });
}

export async function getRecentEmailJobs({ kind = null, limit = 20 } = {}) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const params = [];
  const where = [];

  if (kind) {
    params.push(String(kind));
    where.push(`kind = $${params.length}`);
  }

  params.push(boundedLimit);
  const result = await pool.query(
    `SELECT id, user_id, kind, email, status, provider, retry_count, max_retries,
            message_id, preview_url, last_error, next_attempt_at, sent_at, created_at, updated_at
     FROM email_jobs
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows.map(mapEmailJob);
}

export function startEmailWorker() {
  if (emailWorkerStarted) return;
  emailWorkerStarted = true;
  emailSweepTimer = setInterval(() => {
    sweepPendingEmailJobs().catch((error) => {
      console.error('[email-worker] sweep failed', error);
    });
  }, EMAIL_JOB_SWEEP_INTERVAL_MS);
  emailSweepTimer.unref?.();
}

export async function sweepPendingEmailJobs() {
  const result = await pool.query(
    `SELECT id
     FROM email_jobs
     WHERE status IN ('pending', 'failed')
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $1`,
    [MAX_SWEEP_BATCH],
  );

  for (const row of result.rows) {
    try {
      await processEmailJob(row.id, { immediate: false });
    } catch {
      // failure is already persisted and logged by processEmailJob
    }
  }
}

export async function getMailerHealth({ verify = false } = {}) {
  const providers = await getProviders();
  const primaryProvider = providers[0] || null;
  const fallbackProvider = providers[1] || null;

  if (!verify) {
    return {
      ok: !!primaryProvider,
      mode: primaryProvider?.kind || 'none',
      configured: !!primaryProvider,
      from: primaryProvider?.from || SUPPORT_EMAIL,
      supportEmail: SUPPORT_EMAIL,
      verified: false,
      timeoutMs: null,
      primary: summarizeProvider(primaryProvider),
      fallback: summarizeProvider(fallbackProvider),
    };
  }

  const startedAt = Date.now();
  const primaryResult = await verifyProvider(primaryProvider);
  const fallbackResult = fallbackProvider ? await verifyProvider(fallbackProvider) : null;

  return {
    ok: !!primaryResult?.ok || !!fallbackResult?.ok,
    mode: primaryProvider?.kind || 'none',
    configured: !!primaryProvider,
    from: primaryProvider?.from || SUPPORT_EMAIL,
    supportEmail: SUPPORT_EMAIL,
    verified: true,
    durationMs: Date.now() - startedAt,
    timeoutMs: MAILER_VERIFY_TIMEOUT_MS,
    primary: primaryResult ? summarizeVerification(primaryResult) : null,
    fallback: fallbackResult ? summarizeVerification(fallbackResult) : summarizeProvider(fallbackProvider),
    error: primaryResult?.ok ? null : (primaryResult?.error || fallbackResult?.error || null),
    errorCode: primaryResult?.ok ? null : (primaryResult?.errorCode || fallbackResult?.errorCode || null),
  };
}

async function attemptEmailDelivery(job) {
  const providers = await getProviders();
  const content = buildEmailContent(job);

  let lastFailure = null;
  for (const provider of providers) {
    const startedAt = Date.now();
    try {
      const info = await withTimeout(
        provider.send({
          from: provider.from,
          to: job.email,
          subject: content.subject,
          text: content.text,
        }),
        MAILER_SEND_TIMEOUT_MS,
        `${provider.name}_send_timeout`,
      );

      return {
        ok: true,
        provider: provider.name,
        transport: provider.kind,
        messageId: info.messageId || null,
        previewUrl: info.previewUrl || nodemailer.getTestMessageUrl(info) || null,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastFailure = {
        ok: false,
        provider: provider.name,
        transport: provider.kind,
        error: error?.message || String(error),
        errorCode: error?.code || null,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  return lastFailure || {
    ok: false,
    provider: null,
    transport: 'none',
    error: 'Nenhum provedor de email configurado',
    errorCode: 'email_provider_missing',
    durationMs: 0,
  };
}

async function getProviders() {
  if (!providerPromises) {
    providerPromises = createProviders();
  }
  return providerPromises;
}

async function createProviders() {
  const providers = [];

  const resend = createResendProvider({
    name: 'resend_primary',
    apiKey: RESEND_API_KEY,
    from: RESEND_FROM,
  });
  if (resend) providers.push(resend);

  const primary = await createProvider({
    name: 'smtp_primary',
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  });
  if (primary) providers.push(primary);

  const fallback = await createProvider({
    name: 'smtp_fallback',
    host: process.env.SMTP_FALLBACK_HOST,
    port: process.env.SMTP_FALLBACK_PORT || process.env.SMTP_PORT,
    secure: process.env.SMTP_FALLBACK_SECURE,
    user: process.env.SMTP_FALLBACK_USER,
    pass: process.env.SMTP_FALLBACK_PASS,
    from: process.env.SMTP_FALLBACK_FROM || process.env.SMTP_FROM,
  });
  if (fallback) providers.push(fallback);

  if (!providers.length) {
    const testAccount = await nodemailer.createTestAccount();
    const transport = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    providers.push({
      name: 'ethereal',
      kind: 'ethereal',
      from: process.env.SMTP_FROM || SUPPORT_EMAIL,
      transport,
      send: (message) => transport.sendMail(message),
      verify: () => transport.verify(),
    });
  }

  return providers;
}

function createResendProvider({ name, apiKey, from }) {
  if (!apiKey) return null;

  return {
    name,
    kind: 'resend',
    from: from || SUPPORT_EMAIL,
    async send({ from: emailFrom, to, subject, text }) {
      const response = await fetch(`${RESEND_API_BASE_URL}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          subject,
          text,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(data?.message || data?.error || `Resend error (${response.status})`);
        error.code = data?.name || `resend_${response.status}`;
        throw error;
      }

      return {
        messageId: data?.id || null,
        previewUrl: null,
      };
    },
    async verify() {
      const response = await fetch(`${RESEND_API_BASE_URL}/domains`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const error = new Error(data?.message || data?.error || `Resend verify error (${response.status})`);
        error.code = data?.name || `resend_verify_${response.status}`;
        throw error;
      }

      return true;
    },
  };
}

async function createProvider({ name, host, port, secure, user, pass, from }) {
  if (!(host && user && pass)) return null;

  const transport = nodemailer.createTransport({
    host,
    port: Number(port || 587),
    secure: String(secure || 'false').trim().toLowerCase() === 'true',
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: { user, pass },
  });

  return {
    name,
    kind: 'smtp',
    from: from || SUPPORT_EMAIL,
    transport,
    send: (message) => transport.sendMail(message),
    verify: () => transport.verify(),
  };
}

async function verifyProvider(provider) {
  if (!provider) return null;
  const startedAt = Date.now();
  try {
    await withTimeout(provider.verify(), MAILER_VERIFY_TIMEOUT_MS, `${provider.name}_verify_timeout`);
    return {
      ok: true,
      provider: provider.name,
      kind: provider.kind,
      from: provider.from,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      provider: provider.name,
      kind: provider.kind,
      from: provider.from,
      error: error?.message || String(error),
      errorCode: error?.code || null,
      durationMs: Date.now() - startedAt,
    };
  }
}

function summarizeProvider(provider) {
  if (!provider) return null;
  return {
    provider: provider.name,
    kind: provider.kind,
    from: provider.from,
  };
}

function summarizeVerification(result) {
  return {
    provider: result.provider,
    kind: result.kind,
    from: result.from,
    ok: !!result.ok,
    error: result.error || null,
    errorCode: result.errorCode || null,
    durationMs: result.durationMs || null,
  };
}

function buildEmailContent(job) {
  const payload = normalizePayload(job.payload);

  if (job.kind === 'password_reset') {
    const code = String(payload.code || '').trim();
    return {
      subject: 'CrossApp - redefinicao de senha',
      text: [
        'Seu codigo de redefinicao de senha do CrossApp:',
        '',
        `Codigo: ${code}`,
        '',
        'Esse codigo expira em 15 minutos.',
        `Suporte: ${SUPPORT_EMAIL}`,
      ].join('\n'),
    };
  }

  if (job.kind === 'email_verification') {
    const code = String(payload.code || '').trim();
    return {
      subject: 'CrossApp - verificacao de email',
      text: [
        'Seu codigo de verificacao do CrossApp:',
        '',
        `Codigo: ${code}`,
        '',
        'Use esse codigo para confirmar sua conta.',
        'Esse codigo expira em 15 minutos.',
        `Suporte: ${SUPPORT_EMAIL}`,
      ].join('\n'),
    };
  }

  if (job.kind === 'account_deletion_review') {
    const userName = String(payload.userName || '').trim();
    const confirmUrl = String(payload.confirmUrl || '').trim();
    const cancelUrl = String(payload.cancelUrl || '').trim();
    const deleteAfter = formatEmailDate(payload.deleteAfter);
    const supportEmail = String(payload.supportEmail || SUPPORT_EMAIL).trim();
    return {
      subject: 'CrossApp - solicitacao de exclusao de conta',
      text: [
        userName ? `Olá, ${userName}.` : 'Olá.',
        '',
        'Uma solicitação administrativa de exclusão da sua conta foi registrada no CrossApp.',
        'Se você quiser prosseguir com a exclusão imediatamente, use o link abaixo:',
        confirmUrl || '(link indisponível)',
        '',
        'Se você quiser manter a conta, use este link:',
        cancelUrl || '(link indisponível)',
        '',
        `Se não houver resposta até ${deleteAfter || '15 dias'}, a conta e os dados relacionados serão excluídos automaticamente.`,
        `Suporte: ${supportEmail}`,
      ].join('\n'),
    };
  }

  return {
    subject: 'CrossApp',
    text: String(payload.text || '').trim(),
  };
}

function normalizePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return typeof payload === 'object' ? payload : {};
}

function formatEmailDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function mapEmailJob(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    kind: row.kind,
    email: row.email,
    status: row.status,
    provider: row.provider || null,
    retryCount: Number(row.retry_count || 0),
    maxRetries: Number(row.max_retries || 0),
    messageId: row.message_id || null,
    previewUrl: row.preview_url || null,
    lastError: row.last_error || null,
    nextAttemptAt: row.next_attempt_at || null,
    sentAt: row.sent_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function scheduleEmailJobRetry(jobId, delayMs) {
  const timer = setTimeout(() => {
    processEmailJob(jobId, { immediate: false }).catch(() => {});
  }, delayMs);
  timer.unref?.();
}

function withTimeout(promise, timeoutMs, code) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Timeout ao processar mailer (${timeoutMs}ms)`);
      error.code = code;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}
