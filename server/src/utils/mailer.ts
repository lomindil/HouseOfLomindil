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

export async function sendPbpInvite(
  email: string,
  displayName: string,
  gameName: string,
  gameUrl: string,
  joinCode: string,
): Promise<void> {
  if (!emailConfigured) {
    if (isDev) console.log(`[mailer] PBP invite → ${email} for game "${gameName}" — code: ${joinCode} — ${gameUrl}`);
    return;
  }

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 520px; margin: auto; background: #1a0a00; color: #e8d5b7; padding: 40px; border: 2px solid #8b6914; border-radius: 8px;">
      <h1 style="color: #d4af37; text-align: center; font-size: 24px; margin-bottom: 4px;">⚔ House of Lomindil ⚔</h1>
      <p style="text-align: center; color: #a08060; margin-bottom: 32px; font-size: 13px;">Play by Post — A Tale Written Together</p>

      <p style="margin-bottom: 16px;">Hail, <strong style="color: #d4af37;">${displayName}</strong>!</p>
      <p style="margin-bottom: 16px;">You have been summoned to join the Play by Post chronicle for:</p>

      <div style="background: #2d1a00; border: 1px solid #8b6914; border-radius: 4px; padding: 16px 24px; text-align: center; margin-bottom: 28px;">
        <span style="font-size: 20px; color: #d4af37; font-weight: bold;">${gameName}</span>
      </div>

      <!-- Join code -->
      <p style="color: #a08060; font-size: 13px; margin-bottom: 8px; text-align: center;">Your game join code</p>
      <div style="background: #2d1a00; border: 1px dashed #8b6914; border-radius: 4px; padding: 14px 24px; text-align: center; margin-bottom: 28px;">
        <span style="font-size: 32px; letter-spacing: 10px; color: #d4af37; font-weight: bold; font-family: monospace;">${joinCode}</span>
      </div>

      <!-- CTA button -->
      <div style="text-align: center; margin-bottom: 36px;">
        <a href="${gameUrl}" style="display: inline-block; background: #8b6914; color: #fff8e1; padding: 12px 36px; border-radius: 4px; text-decoration: none; font-size: 16px; font-weight: bold; letter-spacing: 0.5px;">
          Enter the Chronicle →
        </a>
      </div>

      <!-- How to play -->
      <div style="background: #2d1a00; border: 1px solid #5a3e0a; border-radius: 4px; padding: 20px 24px; margin-bottom: 24px;">
        <p style="color: #d4af37; font-size: 13px; font-weight: bold; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 1px;">How to Play</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #c8b080;">
          <tr>
            <td style="padding: 5px 0; width: 26px; vertical-align: top; color: #d4af37;">①</td>
            <td style="padding: 5px 0; vertical-align: top;"><strong style="color: #e8d5b7;">Sign in</strong> at the link above using your email — you'll receive a one-time login code, no password needed.</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; vertical-align: top; color: #d4af37;">②</td>
            <td style="padding: 5px 0; vertical-align: top;"><strong style="color: #e8d5b7;">Enter the join code</strong> <span style="font-family: monospace; color: #d4af37; font-weight: bold;">${joinCode}</span> on the Play by Post page if prompted — this links you to the game.</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; vertical-align: top; color: #d4af37;">③</td>
            <td style="padding: 5px 0; vertical-align: top;"><strong style="color: #e8d5b7;">Read the Dungeon Master's posts</strong> and reply with your character's actions, dialogue, or reactions. Take your time — there's no rush, post when inspiration strikes.</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; vertical-align: top; color: #d4af37;">④</td>
            <td style="padding: 5px 0; vertical-align: top;"><strong style="color: #e8d5b7;">Roll dice</strong> when the DM grants you rolls. Open the Dice panel on the right, pick your dice, and roll — results are visible to the whole party.</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; vertical-align: top; color: #d4af37;">⑤</td>
            <td style="padding: 5px 0; vertical-align: top;"><strong style="color: #e8d5b7;">Check the Party panel</strong> to see your character sheet, party HP, and what everyone is up to.</td>
          </tr>
        </table>
      </div>

      <p style="color: #a08060; font-size: 12px; text-align: center; line-height: 1.6;">
        Questions? Reply to this email or reach out to your Dungeon Master.<br>
        The chronicle awaits your mark upon its pages.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"House of Lomindil" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `⚔ You're invited to Play by Post — ${gameName}`,
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
