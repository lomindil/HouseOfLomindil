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

export async function sendArmyConfirmation(
  email: string,
  displayName: string,
  campaignName: string,
): Promise<void> {
  if (!emailConfigured) {
    if (isDev) console.log(`[mailer] Army confirmation → ${email} for campaign "${campaignName}"`);
    return;
  }

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 480px; margin: auto; background: #1a0a00; color: #e8d5b7; padding: 40px; border: 2px solid #8b6914; border-radius: 8px;">
      <h1 style="color: #d4af37; text-align: center; font-size: 24px; margin-bottom: 8px;">⚔ House of Lomindil ⚔</h1>
      <p style="text-align: center; color: #a08060; margin-bottom: 32px;">Campaign Army</p>
      <p style="margin-bottom: 16px;">Hail, <strong style="color: #d4af37;">${displayName}</strong>!</p>
      <p style="margin-bottom: 16px;">Your name has been etched into the Campaign Army for:</p>
      <div style="background: #2d1a00; border: 1px solid #8b6914; border-radius: 4px; padding: 16px 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 20px; color: #d4af37; font-weight: bold;">${campaignName}</span>
      </div>
      <p style="color: #a08060; font-size: 13px;">The Dungeon Master will reach out when a seat opens. Until then — sharpen your blades.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"House of Lomindil" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `⚔ You've joined the Campaign Army — ${campaignName}`,
    html,
  });
}

export async function sendArmyAlert(
  campaignName: string,
  displayName: string,
  email: string,
  phone: string,
  message: string,
): Promise<void> {
  if (!emailConfigured) {
    if (isDev) console.log(`[mailer] Army alert → admin for "${displayName}" <${email}> on "${campaignName}"`);
    return;
  }

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 480px; margin: auto; background: #1a0a00; color: #e8d5b7; padding: 40px; border: 2px solid #8b6914; border-radius: 8px;">
      <h1 style="color: #d4af37; text-align: center; font-size: 24px; margin-bottom: 8px;">⚔ House of Lomindil ⚔</h1>
      <p style="text-align: center; color: #a08060; margin-bottom: 32px;">New Campaign Army Signup</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="color: #a08060; padding: 6px 0; width: 90px;">Campaign</td><td style="color: #d4af37; font-weight: bold;">${campaignName}</td></tr>
        <tr><td style="color: #a08060; padding: 6px 0;">Name</td><td style="color: #e8d5b7;">${displayName}</td></tr>
        <tr><td style="color: #a08060; padding: 6px 0;">Email</td><td style="color: #e8d5b7;">${email}</td></tr>
        <tr><td style="color: #a08060; padding: 6px 0;">Phone</td><td style="color: #e8d5b7;">${phone || '—'}</td></tr>
        <tr><td style="color: #a08060; padding: 6px 0; vertical-align: top;">Message</td><td style="color: #e8d5b7;">${message || '—'}</td></tr>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from: `"House of Lomindil" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL || 'amnchaturvedi1@gmail.com',
    subject: `⚔ New Army Signup — ${campaignName} (${displayName})`,
    html,
  });
}
