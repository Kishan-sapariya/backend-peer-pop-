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
    const sendSmtpEmail = {
      sender: {
        name: "Peer Pop",
        email: "peerpopdevelopment@gmail.com",
      },
      to: [{ email }],
      subject: "You're on the Peer Pop Waitlist 🎉",
      htmlContent: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0a0a0a; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #FFD43B; font-size: 26px; margin-bottom: 8px;">Welcome to Peer Pop ✨</h1>
            <p style="color: #bbb; font-size: 15px;">Hey${
              name ? ` ${name}` : ""
            }, you’re officially on the waitlist!</p>
          </div>

          <div style="background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
                      padding: 24px; border-radius: 10px; color: #111; text-align: center;">
            <h2 style="margin: 0 0 10px 0; font-size: 20px;">${
              role === "BRAND" ? "For Brands" : "For Creators"
            } like you</h2>
            <p style="margin: 0; font-size: 15px; line-height: 1.6;">
              You’ve been added to the early access waitlist.  
              We’ll notify you the moment registrations open so you can secure your spot first.
            </p>
          </div>

          <div style="margin-top: 28px; text-align: center;">
            <p style="color: #aaa; font-size: 14px;">Stay tuned for updates from <strong>Peer Pop</strong>.<br/>
            Follow us on social to stay ahead of launch announcements!</p>
          </div>

          <div style="margin-top: 30px; text-align: center; color: #555; font-size: 12px;">
            <p>If you didn’t request this, you can ignore this email.</p>
          </div>
        </div>
      `,
      textContent: `Hey${
        name ? ` ${name}` : ""
      }! You’re officially on the Peer Pop waitlist.
We’ll notify you as soon as registration opens.
Stay tuned for updates!`,
    };

    const result = await brevo.sendTransacEmail(sendSmtpEmail);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Waitlist email failed:", error.message || error);
    return { success: false, error: "Email send failed" };
  }
};
