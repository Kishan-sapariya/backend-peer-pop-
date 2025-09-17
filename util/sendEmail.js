import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, 
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000, 
  greetingTimeout: 15000, 
  socketTimeout: 30000, 
  pool: true,
  maxConnections: 3, 
  maxMessages: 50,
  tls: {
    rejectUnauthorized: false, 
    ciphers: 'SSLv3'
  },
  debug: process.env.NODE_ENV === 'production',
  logger: process.env.NODE_ENV === 'production'
});

export const sendOTP = async (email, otp) => {
  try {
    
    const mailOptions = {
      from: `"Peer Pop" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Email Verification OTP - Peer Pop",
      html: `
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
      text: `Your Peer Pop verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this verification, please ignore this email.`
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    
    // Specific error handling for common Render issues
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Email service timeout - please try again in a moment');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Email service unavailable - please contact support');
    } else if (error.responseCode === 535) {
      throw new Error('Email authentication failed - please contact support');
    } else {
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }
};