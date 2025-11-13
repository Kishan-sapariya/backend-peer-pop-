import Brevo from "@getbrevo/brevo";

const brevo = new Brevo.TransactionalEmailsApi();
brevo.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

console.log(process.env.BREVO_API_KEY);

function logBrevoError(error) {
  console.error("\n ===== BREVO ERROR DEBUG ===== ");

  // Generic message
  console.error("Message:", error.message);

  // axios-style response object (Brevo SDK uses axios under the hood)
  if (error.response) {
    console.error("Status:", error.response.status);
    console.error("Status Text:", error.response.statusText);
    console.error("Headers:", error.response.headers);
    console.error("Data:", JSON.stringify(error.response.data, null, 2));
  }

  // Special Brevo error fields
  if (error.body) {
    console.error("Body:", error.body);
  }

  // Raw error dump
  console.error("Full Error Object:", error);

  console.error(" ===== END BREVO ERROR DEBUG ===== \n");
}

export const sendOTP = async (email, otp) => {
  try {
    const sendSmtpEmail = {
      sender: {
        name: "Peer Pop",
        email: "peerpopdevelopment@gmail.com",
      },
      to: [{ email }],
      subject: "Email Verification OTP - Peer Pop",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">Peer Pop</h1>
            <p style="color: #666; margin: 5px 0;">Email Verification</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="color: white; margin: 0 0 10px 0;">Your Verification Code</h2>
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; margin: 15px 0;">
              <span style="color: white; font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
            </div>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">This code expires in 10 minutes</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
            <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
          </div>
        </div>
      `,
      textContent: `Your Peer Pop verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this verification, please ignore this email.`,
    };

    const result = await brevo.sendTransacEmail(sendSmtpEmail);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logBrevoError(error);
    console.error("❌ Email sending failed:", error.message || error);
    throw new Error("Email delivery failed - please try again later");
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
    logBrevoError(error);
    console.error("❌ Waitlist email failed:", error.message || error);
    return { success: false, error: "Email send failed" };
  }
};
