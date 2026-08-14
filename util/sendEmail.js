import fetch from "node-fetch";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export const sendOTP = async (email, otp) => {
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Peer Pop",
          email: "no-reply@peerpop.in",
        },
        to: [{ email }],
        subject: "Email Verification OTP - Peer Pop",
	htmlContent: `
  <div style="
    font-family: Arial, Helvetica, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    background: #0a0a0a;
    padding: 32px;
    border-radius: 12px;
    color: #f5f5f5;
  ">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="
        color: #facc15;
        margin: 0;
        font-size: 28px;
        letter-spacing: 1px;
      ">
        Peer Pop
      </h1>
      <p style="color: #9ca3af; margin-top: 8px;">
        Email Verification
      </p>
    </div>

    <div style="
      background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
      color: #111;
      padding: 24px;
      border-radius: 10px;
      text-align: center;
      margin: 24px 0;
    ">
      <p style="margin: 0 0 12px 0; font-size: 16px;">
        Your verification code
      </p>
      <div style="
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 6px;
      ">
        ${otp}
      </div>
      <p style="margin-top: 12px; font-size: 14px;">
        Expires in 10 minutes
      </p>
    </div>

    <div style="text-align: center; font-size: 14px; color: #9ca3af;">
      <p>If you didn’t request this code, you can safely ignore this email.</p>
      <p style="margin-top: 16px; font-size: 12px; color: #6b7280;">
        © ${new Date().getFullYear()} Peer Pop
      </p>
    </div>
  </div>
`,

      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Brevo API error:", data);
      throw new Error("Brevo API rejected request");
    }

    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw new Error("Email delivery failed");
  }
};


export const sendWaitlistConfirmationEmail = async (email, name, role) => {
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Peer Pop",
          email: "no-reply@peerpop.in",
        },
        to: [{ email }],
        subject: "You're on the Peer Pop Waitlist!",
        htmlContent: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0a0a0a; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #FFD43B; font-size: 26px; margin-bottom: 8px;">Welcome to Peer Pop</h1>
              <p style="color: #bbb; font-size: 15px;">Hey${
                name ? ` ${name}` : ""
              }, you're officially on the waitlist!</p>
            </div>

            <div style="background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
                        padding: 24px; border-radius: 10px; color: #111; text-align: center;">
              <h2 style="margin: 0 0 10px 0; font-size: 20px;">${
                role === "BRAND" ? "For Brands" : "For Creators"
              } like you</h2>
              <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                You've been added to the early access waitlist.
                We'll notify you the moment registrations open so you can secure your spot first.
              </p>
            </div>

            <div style="margin-top: 28px; text-align: center;">
              <p style="color: #aaa; font-size: 14px;">Stay tuned for updates from <strong>Peer Pop</strong>.<br/>
              Follow us on social to stay ahead of launch announcements!</p>
            </div>

            <div style="margin-top: 30px; text-align: center; color: #555; font-size: 12px;">
              <p>If you didn't request this, you can ignore this email.</p>
            </div>
          </div>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Brevo API error:", data);
      throw new Error("Brevo API rejected request");
    }

    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("❌ Waitlist email failed:", error.message || error);
    return { success: false, error: "Email send failed" };
  }
};

// Escape user-provided text so it can't inject HTML into the email template.
const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const LINK_STYLE = "color:#a16207;font-weight:600;text-decoration:underline;";

// Turn links in already-escaped text into <a> tags. Supports two forms:
//   [label](https://url)  -> clickable link with custom text
//   https://url           -> clickable link showing the URL
// Uses placeholder tokens so a URL is never linkified twice.
const linkifyEscaped = (escaped = "") => {
  const links = [];
  const stash = (html) => {
    links.push(html);
    return `\x00${links.length - 1}\x00`;
  };

  const s = escaped
    // [label](url) — markdown-style link with custom text
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) =>
      stash(`<a href="${url}" style="${LINK_STYLE}">${label}</a>`)
    )
    // bare http(s) URL (trailing sentence punctuation kept outside the link)
    .replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const trailing = (url.match(/[.,;:!?]+$/) || [""])[0];
      const clean = url.slice(0, url.length - trailing.length);
      return stash(`<a href="${clean}" style="${LINK_STYLE}">${clean}</a>`) + trailing;
    });

  return s.replace(/\x00(\d+)\x00/g, (_m, i) => links[Number(i)]);
};

// Turn a plain-text message into safe HTML paragraphs.
// Blank lines separate paragraphs; single newlines become <br/>.
const textToHtmlParagraphs = (text = "") =>
  escapeHtml(text.trim())
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px;">${linkifyEscaped(para).replace(
          /\n/g,
          "<br/>"
        )}</p>`
    )
    .join("");

// Build the branded HTML for an admin-composed broadcast email.
// Exported so the exact same markup can be unit-tested / previewed.
export const buildCustomEmailHtml = ({ name, subject, message, regards }) => {
  const greetingName = name ? escapeHtml(name) : "there";
  const year = new Date().getFullYear();
  const bodyHtml = textToHtmlParagraphs(message);
  const regardsHtml = regards
    ? `<div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #eeeeee;color:#374151;">
         ${textToHtmlParagraphs(regards)}
       </div>`
    : "";

  return `
  <div style="background:#f4f4f5;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eeeeee;">
      <!-- Header -->
      <div style="background:#facc15;padding:22px 32px;text-align:center;">
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#111111;letter-spacing:0.5px;">Peerpop</h1>
      </div>
      <!-- Body -->
      <div style="padding:32px;color:#1f2937;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 20px;">Hi ${greetingName},</p>
        ${
          subject
            ? `<h2 style="margin:0 0 18px;font-size:21px;color:#111111;font-weight:800;line-height:1.35;">${escapeHtml(
                subject
              )}</h2>`
            : ""
        }
        ${bodyHtml}
        ${regardsHtml}
      </div>
      <!-- Footer -->
      <div style="background:#111111;padding:18px 32px;text-align:center;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">© ${year} Peerpop · Where creators meet opportunity</p>
      </div>
    </div>
  </div>`;
};

// Send an admin-composed email to a single recipient. Personalized greeting,
// branded template. Never throws — returns { success }.
export const sendCustomEmail = async (email, name, { subject, message, regards }) => {
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Peerpop", email: "no-reply@peerpop.in" },
        to: [{ email }],
        subject,
        htmlContent: buildCustomEmailHtml({ name, subject, message, regards }),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Brevo API error (custom):", data);
      return { success: false, error: "Email send failed" };
    }
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("❌ Custom email failed:", error.message || error);
    return { success: false, error: "Email send failed" };
  }
};

// Welcome email sent after a user completes signup (verifies their email).
// Never throws — a mail hiccup must not break the signup flow.
export const sendWelcomeEmail = async (email, name) => {
  const appUrl = process.env.FRONTEND_URL || "https://peerpop.in";
  const greetingName = name ? ` ${name}` : "";
  const year = new Date().getFullYear();

  const step = (text) => `
    <tr>
      <td style="padding:5px 0;vertical-align:top;width:18px;">
        <span style="color:#eab308;font-weight:800;">›</span>
      </td>
      <td style="padding:5px 0 5px 10px;">${text}</td>
    </tr>`;

  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Peerpop", email: "no-reply@peerpop.in" },
        to: [{ email }],
        subject: "Welcome to Peerpop!",
        htmlContent: `
  <div style="background:#f4f4f5;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eeeeee;">
      <!-- Header -->
      <div style="background:#facc15;padding:22px 32px;text-align:center;">
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#111111;letter-spacing:0.5px;">Peerpop</h1>
      </div>
      <!-- Body -->
      <div style="padding:32px;color:#1f2937;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 16px;">Hi${greetingName},</p>
        <h2 style="margin:0 0 16px;font-size:22px;color:#111111;font-weight:800;">Welcome to Peerpop! 🎉</h2>
        <p style="margin:0 0 16px;">We're excited to have you join our growing community of creators, artists, performers, influencers, and professionals.</p>
        <p style="margin:0 0 20px;">Peerpop is designed to help you showcase your work, grow your audience, and unlock new opportunities through a professional digital presence.</p>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:18px 20px;margin:0 0 24px;">
          <p style="margin:0 0 10px;font-weight:700;color:#111111;">Here's what to do next:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;color:#1f2937;">
            ${step("Complete your profile with your bio, photos, and social links.")}
            ${step("Add your work, portfolio, or content to make your profile stand out.")}
            ${step("Keep your profile updated so brands and collaborators can discover you.")}
          </table>
        </div>

        <div style="text-align:center;margin:0 0 26px;">
          <a href="${appUrl}" style="display:inline-block;background:#facc15;color:#111111;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:9999px;">
            Complete your profile →
          </a>
        </div>

        <p style="margin:0 0 16px;">Our team is continuously improving the platform and adding new features to help creators succeed. If you have any questions, feedback, or need assistance setting up your profile, simply reply to this email—we're always happy to help.</p>
        <p style="margin:0 0 6px;">Thank you for joining Peerpop.</p>
        <p style="margin:0 0 20px;font-weight:700;color:#111111;">Welcome aboard!</p>
        <p style="margin:0;color:#6b7280;">Best regards,<br/><strong style="color:#111111;">Team Peerpop</strong></p>
      </div>
      <!-- Footer -->
      <div style="background:#111111;padding:18px 32px;text-align:center;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">© ${year} Peerpop · Where creators meet opportunity</p>
      </div>
    </div>
  </div>
`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Brevo API error (welcome):", data);
      return { success: false, error: "Email send failed" };
    }
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("❌ Welcome email failed:", error.message || error);
    return { success: false, error: "Email send failed" };
  }
};
