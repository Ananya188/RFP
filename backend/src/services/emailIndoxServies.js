// services/emailInboxService.js
import Imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import XLSX from 'xlsx';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const _ = require('lodash');

const IMAP_CONFIG = {
  imap: {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    tls:
      process.env.IMAP_TLS
        ? process.env.IMAP_TLS.toLowerCase() === 'true'
        : true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 3000
  }
};

export function extractRfpIdFromSubject(subject = '') {
  const m = subject.match(/\[RFP:\s*([0-9a-fA-F]{24})\]/);
  return m ? m[1] : null;
}

function readImapBody(msg) {
  return new Promise((resolve) => {
    let buffer = '';
    msg.on('body', (stream) => {
      stream.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
      });
    });
    msg.once('end', () => resolve(buffer));
  });
}

async function tryExtractTextualAttachment(att) {
  const buf = att.content;
  if (!buf) return null;
  const MAX = 300 * 1024;
  const type = (att.contentType || '').toLowerCase();

  if (type.startsWith('text/')) {
    return buf.toString('utf8').slice(0, MAX);
  }

  if (type === 'application/pdf' || att.filename?.toLowerCase().endsWith('.pdf')) {
    try {
      const pdf = await pdfParse(buf);
      return pdf.text?.slice(0, MAX) || null;
    } catch {
      return null;
    }
  }

  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    att.filename?.toLowerCase().endsWith('.xlsx')
  ) {
    try {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheets = wb.SheetNames.slice(0, 3).map((name) => ({
        name,
        json: XLSX.utils.sheet_to_json(wb.Sheets[name])
      }));
      return JSON.stringify(sheets).slice(0, MAX);
    } catch {
      return null;
    }
  }

  return null;
}

export async function fetchAndParseUnseenEmails({ maxMessages = 5, markSeen = true } = {}) {
  console.info('[imap] starting connect');
  const connection = await Imap.connect(IMAP_CONFIG);
  console.info('[imap] connected');

  try {
    console.info('[imap] opening INBOX');
    await connection.openBox('INBOX');
    console.info('[imap] searching for UNSEEN');
    const searchCriteria = ['UNSEEN']; // or keep ['1:5'] if you're testing
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };

    const messages = await connection.search(searchCriteria, fetchOptions);

    messages.forEach((item) => {
      const all = _.find(item.parts, { which: 'TEXT' });
      if (!all) return; // safety

      // ⚠️ This may or may not be base64; depends on encoding
      const html = Buffer.from(all.body, 'base64').toString('ascii');
      console.log(html);
    });
    console.info(`[imap] search returned ${messages.length} messages`);
    if (!messages.length) return [];

    const limited = messages.slice(0, maxMessages);
    const results = [];

    for (const [i, item] of limited.entries()) {
      console.info(
        `[imap] processing message ${i + 1}/${limited.length} uid=${item.attributes?.uid
        }`
      );
      const uid = item.attributes.uid;

      // fetch raw body stream with per-message timeout
      const raw = await new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          console.warn('[imap] per-message fetch timeout uid=', uid);
          reject(new Error('per-message fetch timeout'));
        }, 10000);

        connection.imap
          .fetch(uid, { bodies: '' })
          .on('message', async (msg) => {
            try {
              const body = await readImapBody(msg);
              clearTimeout(t);
              resolve(body);
            } catch (e) {
              clearTimeout(t);
              reject(e);
            }
          })
          .once('error', (err) => {
            clearTimeout(t);
            reject(err);
          });
      });

      console.info('[imap] parsed raw body for uid=', uid, ' — now simpleParser()');
      const parsed = await simpleParser(raw);
      console.info(
        '[imap] simpleParser done uid=',
        uid,
        ' attachments=',
        parsed.attachments?.length || 0
      );

      const attachmentsMeta = [];
      const attachmentsText = [];

      if (parsed.attachments?.length) {
        for (const att of parsed.attachments) {
          attachmentsMeta.push({
            filename: att.filename,
            size: att.size || null,
            contentType: att.contentType
          });
          try {
            const txt = await tryExtractTextualAttachment(att);
            if (txt) {
              attachmentsText.push({
                filename: att.filename,
                content: txt.slice(0, 2000)
              });
            }
          } catch {
            // ignore extraction errors
          }
        }
      }

      results.push({
        uid: String(uid),
        subject: parsed.subject || '',
        from: parsed.from?.text || '',
        fromValue: parsed.from?.value || [],
        date: parsed.date || new Date(),
        text: parsed.text || '',
        html: parsed.html || '',
        attachments: attachmentsMeta,
        attachmentsText
      });

      if (markSeen) {
        try {
          await connection.addFlags(uid, ['\\Seen']);
        } catch (e) {
          console.warn('[imap] addFlags failed uid=', uid, e.message);
        }
      }

      console.info(`[imap] finished message uid=${uid}`);
    }

    return results;
  } finally {
    try {
      await connection.end();
      console.info('[imap] connection closed');
    } catch (e) {
      console.warn('[imap] connection end failed', e.message);
    }
  }
}
