// services/emailService.js
import nodemailer from 'nodemailer';
import os from 'os';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

export const sendEmail = async ({ to, subject, text, html, from }) => {
  const t = getTransporter();
  const mailOptions = {
    from: from || process.env.FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  };
  return t.sendMail(mailOptions);
};

/**
 * sendRfpEmail
 * - rfp: Rfp mongoose document (or plain object)
 * - vendor: Vendor mongoose document (or plain object)
 * - opts: { subject, message, attachJson: boolean }
 *
 * returns nodemailer result
 */
export const sendRfpEmail = async (rfp, vendor, opts = {}) => {
  if (!vendor?.email) throw new Error('vendor has no email');

  const adminName = process.env.ADMIN_NAME || 'Procurement Team';
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const subject = opts.subject || `RFP Invitation: ${rfp.title}`;
  const customMessage = opts.message || '';

  // Build a plain text summary
  const itemsText = (rfp.items || []).map(i => {
    const qty = i.quantity ?? 1;
    const specs = i.specs ? ` (${Object.entries(i.specs).map(([k,v]) => `${k}: ${v}`).join(', ')})` : '';
    return `- ${qty} x ${i.name}${specs}`;
  }).join(os.EOL);

  const text = [
    `Hello ${vendor.contactName || vendor.name || ''},`,
    '',
    customMessage || `You are invited to submit a proposal for the RFP below.`,
    '',
    `Title: ${rfp.title}`,
    `Description: ${rfp.description || ''}`,
    '',
    `Items:`,
    itemsText || '- (no items listed)',
    '',
    rfp.totalBudget != null ? `Estimated Budget: ${rfp.totalBudget}` : '',
    rfp.deliveryDays != null ? `Delivery: within ${rfp.deliveryDays} days` : '',
    rfp.paymentTerms ? `Payment terms: ${rfp.paymentTerms}` : '',
    rfp.warrantyMonths ? `Warranty: ${rfp.warrantyMonths} months` : '',
    '',
    `Please reply with your proposal including prices, lead time, and terms.`,
    `Reference RFP ID: ${rfp._id}`,
    '',
    `Regards,`,
    `${adminName}`
  ].filter(Boolean).join(os.EOL);

  // Simple HTML version (safe, not styled heavy)
  const htmlItems = (rfp.items || []).map(i => {
    const qty = i.quantity ?? 1;
    const specsHtml = i.specs ? `<small>${Object.entries(i.specs).map(([k,v]) => `${k}: ${v}`).join('<br/>')}</small>` : '';
    return `<li><strong>${qty}x ${i.name}</strong><br/>${specsHtml}</li>`;
  }).join('');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4">
      <p>Hello ${vendor.contactName || vendor.name || ''},</p>
      <p>${customMessage || `You are invited to submit a proposal for the RFP below.`}</p>
      <h3>RFP: ${rfp.title}</h3>
      <p>${rfp.description || ''}</p>
      <h4>Items</h4>
      <ul>
        ${htmlItems || '<li>(no items listed)</li>'}
      </ul>
      <p>${rfp.totalBudget != null ? `<strong>Estimated Budget:</strong> ${rfp.totalBudget}<br/>` : ''}
      ${rfp.deliveryDays != null ? `<strong>Delivery:</strong> within ${rfp.deliveryDays} days<br/>` : ''}
      ${rfp.paymentTerms ? `<strong>Payment terms:</strong> ${rfp.paymentTerms}<br/>` : ''}
      ${rfp.warrantyMonths ? `<strong>Warranty:</strong> ${rfp.warrantyMonths} months<br/>` : ''}</p>
      <p>Please reply with your proposal including prices, lead time, and terms.<br/>
      Reference RFP ID: ${rfp._id}</p>
      <p>Regards,<br/>${adminName}</p>
    </div>
  `;

  // Optionally attach JSON representation of the RFP
  const attachments = [];
  if (opts.attachJson) {
    const jsonContent = Buffer.from(JSON.stringify(rfp, null, 2), 'utf8');
    attachments.push({
      filename: `RFP-${rfp._id}.json`,
      content: jsonContent,
      contentType: 'application/json'
    });
  }

  const mailOptions = {
    from: fromEmail,
    to: vendor.email,
    subject,
    text,
    html,
    attachments: attachments.length ? attachments : undefined
  };

  const transporter = getTransporter();
  const info = await transporter.sendMail(mailOptions);
  return info;
};

