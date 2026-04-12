function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

export type MatchaAuthEmailLayoutInput = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
  supportingNote?: string;
  footer?: string;
};

export function renderMatchaAuthEmailHtml(
  input: MatchaAuthEmailLayoutInput
) {
  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#C8D8CC;">${escapeHtml(
          paragraph
        )}</p>`
    )
    .join("");

  const supportingNote = input.supportingNote
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:21px;color:#9BB8A4;">${escapeHtml(
        input.supportingNote
      )}</p>`
    : "";

  const footer = input.footer
    ? `<p style="margin:0;font-size:12px;line-height:19px;color:#7F9A86;">${escapeHtml(
        input.footer
      )}</p>`
    : "";

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0F1A14;color:#F0F5F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(input.preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F1A14;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
            <tr>
              <td style="padding:0 0 18px;">
                <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(82,183,136,0.14);border:1px solid rgba(82,183,136,0.24);font-size:11px;letter-spacing:0.3px;text-transform:uppercase;color:#52B788;font-weight:600;">
                  ${escapeHtml(input.eyebrow)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 18px;">
                <div style="font-size:32px;line-height:1;color:#F0F5F1;font-weight:700;letter-spacing:-0.8px;">MatchA</div>
              </td>
            </tr>
            <tr>
              <td style="background:#1C2B1F;border:1px solid #2A3F2E;border-radius:28px;padding:28px 24px;">
                <p style="margin:0 0 10px;font-size:15px;line-height:24px;color:#F0F5F1;">${escapeHtml(
                  input.greeting
                )}</p>
                <h1 style="margin:0 0 18px;font-size:30px;line-height:36px;color:#F0F5F1;font-weight:700;letter-spacing:-1px;">${escapeHtml(
                  input.title
                )}</h1>
                ${paragraphs}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0;">
                  <tr>
                    <td align="center" bgcolor="#52B788" style="border-radius:16px;">
                      <a href="${escapeAttribute(
                        input.actionUrl
                      )}" style="display:inline-block;padding:15px 22px;font-size:15px;font-weight:700;color:#0F1A14;text-decoration:none;">
                        ${escapeHtml(input.actionLabel)}
                      </a>
                    </td>
                  </tr>
                </table>
                ${supportingNote}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 4px 0;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
