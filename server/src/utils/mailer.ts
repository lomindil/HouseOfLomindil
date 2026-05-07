import nodemailer from 'nodemailer';

const isDev = process.env.NODE_ENV !== 'production';
const emailConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS &&
  !process.env.SMTP_USER.includes('your@') && !process.env.SMTP_PASS.includes('your-'));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOTP(email: string, code: string): Promise<void> {
  if (!emailConfigured) {
    if (isDev) {
      console.log(`\n  ╔══════════════════════════════╗`);
      console.log(`  ║  OTP for ${email.padEnd(20)}║`);
      console.log(`  ║  Code: ${code.padEnd(22)}║`);
      console.log(`  ╚══════════════════════════════╝\n`);
    }
    return; // Skip email sending — OTP is shown in console
  }

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 480px; margin: auto; background: #1a0a00; color: #e8d5b7; padding: 40px; border: 2px solid #8b6914; border-radius: 8px;">
      <h1 style="color: #d4af37; text-align: center; font-size: 24px; margin-bottom: 8px;">⚔ House of Lomindil ⚔</h1>
      <p style="text-align: center; color: #a08060; margin-bottom: 32px;">Your one-time passage code</p>
      <div style="background: #2d1a00; border: 1px solid #8b6914; border-radius: 4px; padding: 24px; text-align: center;">
        <span style="font-size: 40px; letter-spacing: 12px; color: #d4af37; font-weight: bold;">${code}</span>
      </div>
      <p style="color: #a08060; font-size: 13px; text-align: center; margin-top: 24px;">This code expires in 10 minutes. Never share it.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"House of Lomindil" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '⚔ Your House of Lomindil Login Code',
    html,
  });
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
