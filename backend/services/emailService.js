const nodemailer = require('nodemailer');

const requiredSmtpVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];

function isEmailConfigured() {
  return requiredSmtpVariables.every((name) => Boolean(process.env[name]));
}

function buildResetEmailHtml(fullName, resetUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your FinPilot AI Password</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
                🚀 FinPilot AI
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your AI-Powered Financial Intelligence Platform</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px;">
              <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:22px;font-weight:700;">Password Reset Request</h2>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
                Hi ${fullName || 'there'}, we received a request to reset the password for your FinPilot AI account.
                Click the button below to set a new password. This link expires in <strong style="color:#f1f5f9;">1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                              color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;
                              padding:16px 40px;border-radius:10px;letter-spacing:0.3px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:32px;">
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
                  Or copy this link into your browser:
                </p>
                <p style="margin:0;color:#818cf8;font-size:13px;word-break:break-all;">${resetUrl}</p>
              </div>

              <!-- Warning -->
              <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:14px 18px;">
                <p style="margin:0;color:#fbbf24;font-size:13px;line-height:1.6;">
                  ⚠️ If you did not request this, you can safely ignore this email. Your account remains secure.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;padding:24px 48px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;line-height:1.7;">
                © ${new Date().getFullYear()} FinPilot AI. All rights reserved.<br />
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendPasswordResetEmail({ email, fullName, resetUrl }) {
  if (!isEmailConfigured()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Reset your FinPilot AI password',
    text: `Hello ${fullName || 'there'},\n\nUse this link to reset your FinPilot AI password. It expires in one hour:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: buildResetEmailHtml(fullName, resetUrl)
  });
}

module.exports = { isEmailConfigured, sendPasswordResetEmail };
