const nodemailer = require('nodemailer');
const config = require('./config');

let transporter = null;

// Initialize mailer
async function initMailer() {
  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    // Real SMTP configuration (e.g., Mailgun, SendGrid, Gmail)
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    console.log(`[Email] Configured with real SMTP server: ${config.smtp.host}`);
  } else {
    // Local / Dev Fallback: Nodemailer test account (Ethereal) or console logger
    console.log('[Email] No SMTP credentials provided. Running in simulated development mode.');
  }
}

// Send verification email
async function sendVerificationEmail(email, name, token) {
  const verificationUrl = `${config.appUrl}/verify.html?token=${token}`;

  // Log clearly to the terminal for easy testing
  console.log('='.repeat(70));
  console.log('📧 [EMAIL NOTIFICATION]');
  console.log(`To: ${name} <${email}>`);
  console.log(`Subject: Verify your email address`);
  console.log(`🔗 Verification Link:`);
  console.log(`   ${verificationUrl}`);
  console.log('='.repeat(70));

  let previewUrl = null;

  try {
    if (transporter) {
      const info = await transporter.sendMail({
        from: `"FoodApp Auth" <${config.smtp.from}>`,
        to: email,
        subject: 'Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5;">Welcome to FoodApp! 👋</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #64748b; font-size: 14px;">This link will expire in 15 minutes.</p>
            <p style="color: #94a3b8; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });
      previewUrl = nodemailer.getTestMessageUrl(info) || null;
    }
  } catch (err) {
    console.error('⚠️ [Email] Failed to send email via SMTP:', err.message);
  }

  return {
    verificationUrl,
    previewUrl,
  };
}

module.exports = {
  initMailer,
  sendVerificationEmail,
};
