import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Transactional email (Resend). All sends are best-effort and never throw:
// callers fire-and-forget. When RESEND_API_KEY is unset or still a placeholder
// (demo mode) we no-op and log, so the app keeps working without email.
// ---------------------------------------------------------------------------

export function getSiteUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (u) return u.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export function emailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  if (key.startsWith("re_placeholder") || key.includes("placeholder")) return false;
  return true;
}

function sender(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;
  return "Blaze & Bun <onboarding@resend.dev>";
}

let resend: Resend | null = null;
function client(): Resend | null {
  if (!emailConfigured()) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY!.trim());
  return resend;
}

type SendInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/** Best-effort send. Resolves `true` on success, `false` if disabled/failed. */
export async function sendEmail(input: SendInput): Promise<boolean> {
  const c = client();
  if (!c) {
    console.info("[email] RESEND_API_KEY not configured; skipping email to", input.to);
    return false;
  }
  try {
    const { data, error } = await c.emails.send({
      from: sender(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    if (error) {
      console.error("[email] send failed:", error.message);
      return false;
    }
    console.info("[email] sent", input.subject, "->", input.to, "id:", data?.id);
    return true;
  } catch (e) {
    console.error("[email] send threw:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Branded layout
// ---------------------------------------------------------------------------

const BRAND_COLOR = "#b91c1c";

function shell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blaze &amp; Bun</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;">
              <div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:0.5px;">Blaze &amp; Bun</div>
              <div style="color:#fecaca;font-size:13px;margin-top:2px;">Wood-fired since day one</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#18181b;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;text-align:center;">
              <div>Blaze &amp; Bun &middot; Wood-fired kitchen</div>
              <div style="margin-top:4px;">This is an automated message &mdash; please don&rsquo;t reply directly.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface OrderConfirmItem {
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface OrderConfirmInput {
  to: string;
  customerName?: string | null;
  orderId: string;
  branchName: string;
  items: OrderConfirmItem[];
  subtotal: string;
  deliveryFee: string;
  tax: string;
  discount: string;
  total: string;
  currency: string;
  deliveryType: string;
  etaMinutes?: number | null;
  deliveryAddress?: string | null;
  paymentMethod: string;
}

export async function sendOrderConfirmation(input: OrderConfirmInput): Promise<boolean> {
  const rows = input.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;">${esc(it.name)} &times; ${esc(it.quantity)}</td>
          <td align="right" style="padding:8px 12px;border-bottom:1px solid #f4f4f5;white-space:nowrap;">${esc(input.currency)} ${esc(it.lineTotal)}</td>
      </tr>`
    )
    .join("");

  const metaRow = (label: string, value: string | null | undefined): string =>
    value
      ? `<tr><td style="padding:6px 0;color:#71717a;width:40%;">${esc(label)}</td><td style="padding:6px 0;font-weight:600;">${esc(value)}</td></tr>`
      : "";

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND_COLOR};">Order confirmed &mdash; ${esc(input.deliveryType)}</h2>
    <p style="margin:0 0 16px;color:#52525b;">Thanks for ordering from ${esc(input.branchName)}${input.customerName ? ", " + esc(input.customerName) : ""}! We&rsquo;re firing up the grill. Here&rsquo;s your order summary.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="padding:6px 0;color:#71717a;width:40%;">Order reference</td>
        <td style="padding:6px 0;font-weight:600;">#${esc(input.orderId.slice(0, 8).toUpperCase())}</td>
      </tr>
      ${metaRow("Payment method", input.paymentMethod.toUpperCase())}
      ${metaRow("Estimated ready", input.etaMinutes ? `~${esc(input.etaMinutes)} min` : null)}
      ${metaRow("Delivery address", input.deliveryAddress)}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;margin:0 0 16px;">
      <thead>
        <tr>
          <th align="left" style="padding:10px 12px;background-color:#fafafa;font-size:13px;color:#71717a;">Item</th>
          <th align="right" style="padding:10px 12px;background-color:#fafafa;font-size:13px;color:#71717a;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr><td style="padding:4px 0;color:#71717a;">Subtotal</td><td align="right" style="padding:4px 0;">${esc(input.currency)} ${esc(input.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Delivery</td><td align="right" style="padding:4px 0;">${esc(input.currency)} ${esc(input.deliveryFee)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Tax</td><td align="right" style="padding:4px 0;">${esc(input.currency)} ${esc(input.tax)}</td></tr>
      ${input.discount && input.discount !== "0.00"
        ? `<tr><td style="padding:4px 0;color:#16a34a;">Promo discount</td><td align="right" style="padding:4px 0;color:#16a34a;">&minus; ${esc(input.currency)} ${esc(input.discount)}</td></tr>`
        : ""}
      <tr>
        <td style="padding:8px 0 0;font-size:16px;font-weight:800;border-top:2px solid #e4e4e7;">Total</td>
        <td align="right" style="padding:8px 0 0;font-size:16px;font-weight:800;border-top:2px solid #e4e4e7;color:${BRAND_COLOR};">${esc(input.currency)} ${esc(input.total)}</td>
      </tr>
    </table>

    <p style="margin:20px 0 0;color:#52525b;font-size:14px;">Track your order status any time in your account, or with the link you received at checkout.</p>
  `;

  return sendEmail({
    to: input.to,
    subject: `Your order #${input.orderId.slice(0, 8).toUpperCase()} is confirmed`,
    html: shell(bodyHtml),
    text:
      `Order confirmed (${input.deliveryType}) from ${input.branchName}.\n` +
      `Order ref: #${input.orderId.slice(0, 8).toUpperCase()}\n` +
      `Total: ${input.currency} ${input.total}\n` +
      `Estimated ready: ${input.etaMinutes ? "~" + input.etaMinutes + " min" : "n/a"}\n\n` +
      input.items.map((it) => `${it.quantity} x ${it.name} — ${input.currency} ${it.lineTotal}`).join("\n"),
  });
}

export async function sendPasswordResetEmail(input: { to: string; resetUrl: string }): Promise<boolean> {
  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND_COLOR};">Reset your password</h2>
    <p style="margin:0 0 16px;color:#52525b;">We received a request to reset the password for your Blaze &amp; Bun account. This link expires in 30 minutes and can be used once.</p>
    <p style="margin:0 0 24px;"><a href="${esc(input.resetUrl)}" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;">Reset password</a></p>
    <p style="margin:0 0 8px;color:#71717a;font-size:13px;">If the button doesn&rsquo;t work, copy and paste this link into your browser:</p>
    <p style="margin:0;color:#71717a;font-size:13px;word-break:break-all;">${esc(input.resetUrl)}</p>
    <p style="margin:20px 0 0;color:#71717a;font-size:13px;">If you didn&rsquo;t request this, you can safely ignore this email &mdash; your password won&rsquo;t change.</p>
  `;

  return sendEmail({
    to: input.to,
    subject: "Reset your Blaze & Bun password",
    html: shell(bodyHtml),
    text: `Reset your Blaze & Bun password.\n\nOpen this link within 30 minutes to set a new password:\n${input.resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}
