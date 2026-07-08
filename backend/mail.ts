// ============================================================
// KasirGo — Mail Client (Resend API via HTTP, no dependency)
// ============================================================
// Pakai Resend.com: HTTP POST ke api.resend.com/emails.
// Free tier: 100 email/hari, butuh RESEND_API_KEY env.
// Dev fallback: kalau RESEND_API_KEY kosong, code/link di-log
// ke console backend (mode testing) — tidak kirim email beneran.

import { config } from "./helpers";

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SendEmailResult {
  sent: boolean;       // true kalau benar-benar terkirim via Resend
  dev_logged: boolean; // true kalau fallback ke console.log
  error?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<SendEmailResult> {
  // ---- Dev mode: RESEND_API_KEY kosong → log ke console ----
  if (!config.resendApiKey) {
    console.log("\n════════════════════════════════════════════");
    console.log(`📧 EMAIL (dev mode — tidak terkirim beneran)`);
    console.log(`To:      ${opts.to}`);
    console.log(`Subject: ${opts.subject}`);
    console.log(`--- Text ---`);
    console.log(opts.text);
    console.log(`════════════════════════════════════════════\n`);
    return { sent: false, dev_logged: true };
  }

  // ---- Production: kirim via Resend API ----
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.mailFrom,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", res.status, errText);
      return { sent: false, dev_logged: false, error: `Resend ${res.status}: ${errText}` };
    }

    return { sent: true, dev_logged: false };
  } catch (err: any) {
    console.error("sendEmail exception:", err);
    return { sent: false, dev_logged: false, error: err?.message || String(err) };
  }
}

// ============================================================
// Email Templates — Verification + Password Reset
// ============================================================
// Inline HTML sederhana, kasir-accent palette, no external CSS deps.

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;color:#e8edf5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#131826;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        <tr><td style="padding:24px 32px;background:linear-gradient(135deg,rgba(0,217,163,0.08),rgba(15,20,36,0.4));border-bottom:1px solid rgba(0,217,163,0.18);">
          <div style="font-size:22px;font-weight:700;color:#ffffff;">Kasir<span style="color:#00d9a3;">Go</span></div>
          <div style="font-size:11px;color:#8b95a8;margin-top:4px;font-family:'JetBrains Mono',monospace;">Sistem kasir cepat bertenaga WASM</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#ffffff;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#52525b;line-height:1.6;">
          Email ini dikirim otomatis oleh sistem KasirGo. Jangan balas email ini.<br>
          © 2026 KasirGo. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, code: string, link: string): Promise<SendEmailResult> {
  const codeBlock = `<div style="margin:24px 0;padding:20px;background:rgba(0,217,163,0.06);border:1px solid rgba(0,217,163,0.25);border-radius:14px;text-align:center;">
    <div style="font-size:11px;color:#8b95a8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Kode Verifikasi</div>
    <div style="font-size:36px;font-weight:700;letter-spacing:0.3em;color:#00d9a3;font-family:'JetBrains Mono',monospace;">${code}</div>
    <div style="font-size:11px;color:#8b95a8;margin-top:8px;">Berlaku 30 menit</div>
  </div>`;

  const linkBtn = `<div style="text-align:center;margin:24px 0;">
    <a href="${link}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#00d9a3,#00b88a);color:#0a0e1a;font-weight:700;text-decoration:none;border-radius:12px;font-size:14px;">Verifikasi Sekarang</a>
  </div>
  <p style="font-size:12px;color:#8b95a8;text-align:center;margin:8px 0 0;">Atau salin link ini ke browser:<br><span style="color:#00d9a3;word-break:break-all;">${link}</span></p>`;

  const body = `<p style="margin:0 0 12px;color:#a1a1aa;font-size:14px;line-height:1.6;">Terima kasih sudah mendaftar di KasirGo. Selesaikan verifikasi email dengan salah satu cara berikut:</p>
    ${codeBlock}
    <div style="text-align:center;color:#52525b;font-size:12px;margin:16px 0;">— atau —</div>
    ${linkBtn}`;

  return sendEmail({
    to,
    subject: "Verifikasi email KasirGo",
    html: emailShell("Verifikasi email kamu", body),
    text: `Verifikasi email KasirGo\n\nKode verifikasi: ${code}\n\nAtau klik link: ${link}\n\nKode berlaku 30 menit.`,
  });
}

export async function sendPasswordResetEmail(to: string, code: string, link: string): Promise<SendEmailResult> {
  const codeBlock = `<div style="margin:24px 0;padding:20px;background:rgba(255,138,61,0.06);border:1px solid rgba(255,138,61,0.25);border-radius:14px;text-align:center;">
    <div style="font-size:11px;color:#8b95a8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Kode Reset Password</div>
    <div style="font-size:36px;font-weight:700;letter-spacing:0.3em;color:#ff8a3d;font-family:'JetBrains Mono',monospace;">${code}</div>
    <div style="font-size:11px;color:#8b95a8;margin-top:8px;">Berlaku 15 menit</div>
  </div>`;

  const linkBtn = `<div style="text-align:center;margin:24px 0;">
    <a href="${link}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#ff8a3d,#e6731f);color:#0a0e1a;font-weight:700;text-decoration:none;border-radius:12px;font-size:14px;">Reset Password</a>
  </div>
  <p style="font-size:12px;color:#8b95a8;text-align:center;margin:8px 0 0;">Atau salin link ini ke browser:<br><span style="color:#ff8a3d;word-break:break-all;">${link}</span></p>`;

  const body = `<p style="margin:0 0 12px;color:#a1a1aa;font-size:14px;line-height:1.6;">Kami menerima permintaan reset password untuk akun KasirGo kamu. Gunakan salah satu cara berikut:</p>
    ${codeBlock}
    <div style="text-align:center;color:#52525b;font-size:12px;margin:16px 0;">— atau —</div>
    ${linkBtn}
    <p style="font-size:12px;color:#52525b;margin-top:24px;">Kalau kamu tidak meminta reset password, abaikan email ini. Password tidak akan diubah.</p>`;

  return sendEmail({
    to,
    subject: "Reset password KasirGo",
    html: emailShell("Reset password kamu", body),
    text: `Reset password KasirGo\n\nKode reset: ${code}\n\nAtau klik link: ${link}\n\nKode berlaku 15 menit. Kalau tidak meminta reset, abaikan email ini.`,
  });
}
