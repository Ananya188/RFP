// scripts/imap-diagnose.js
import Imap from 'imap-simple';
import { performance } from 'perf_hooks';
import 'dotenv/config'

const cfg = {
  imap: {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    tls: process.env.IMAP_TLS ? process.env.IMAP_TLS.toLowerCase() === 'true' : true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 20000
  }
  
};
console.log('IMAP host:', process.env.IMAP_HOST);
console.log('IMAP port:', process.env.IMAP_PORT);


async function run() {
  console.log('[diag] starting');
  const start = performance.now();
  let conn;
  try {
    console.log('[diag] connecting...');
    const t1 = performance.now();
    conn = await Imap.connect(cfg);
    console.log('[diag] connect OK in', Math.round(performance.now() - t1), 'ms');

    console.log('[diag] opening INBOX...');
    const t2 = performance.now();
    await conn.openBox('INBOX');
    console.log('[diag] openBox OK in', Math.round(performance.now() - t2), 'ms');

    console.log('[diag] listing boxes (quick check)...');
    const t3 = performance.now();
    const boxes = await new Promise((resolve, reject) => {
  conn.imap.getBoxes((err, mailboxes) => {
    if (err) return reject(err);
    resolve(mailboxes);
  });
});
    console.log('[diag] boxes fetched in', Math.round(performance.now() - t3), 'ms');
    console.log('[diag] top-level boxes keys:', Object.keys(boxes).slice(0,10));

    console.log('[diag] running search for UNSEEN (with 20s per-search timeout)...');
    const t4 = performance.now();
    // wrap search with a timeout so script doesn't hang indefinitely
    const searchPromise = conn.search(['UNSEEN'], { bodies: ['HEADER'], struct: true });
    const searchRes = await Promise.race([
      searchPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('search timeout after 20000ms')), 20_000))
    ]);
    console.log('[diag] search returned', (searchRes || []).length, 'items in', Math.round(performance.now() - t4), 'ms');

    console.log('[diag] -- done successfully in', Math.round(performance.now() - start), 'ms');
  } catch (err) {
    console.error('[diag] ERROR:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack.split('\n').slice(0,6).join('\n'));
  } finally {
    try { if (conn) await conn.end(); } catch (e) {}
    process.exit(0);
  }
}

run();
