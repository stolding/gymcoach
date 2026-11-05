// Minimale SMTP-client (geen afhankelijkheden): STARTTLS of TLS, AUTH PLAIN/LOGIN, bijlagen.
import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';
import os from 'node:os';

const addrOf = (s) => (/<([^>]+)>/.exec(String(s)) || [null, String(s).trim()])[1];

// Leest SMTP-antwoorden regel voor regel van een socket (ook meerregelige antwoorden).
function reader(sock) {
  let buf = '';
  const waiters = [];
  const lines = [];
  const pump = () => {
    // een antwoord is compleet bij een regel "123 tekst" (zonder streepje)
    while (waiters.length) {
      const i = lines.findIndex((l) => /^\d{3}(?: |$)/.test(l));
      if (i < 0) return;
      const resp = lines.splice(0, i + 1);
      const code = Number(resp[resp.length - 1].slice(0, 3));
      waiters.shift().resolve({ code, text: resp.join('\n') });
    }
  };
  const onData = (d) => { buf += d.toString('utf8'); let j; while ((j = buf.indexOf('\r\n')) >= 0) { lines.push(buf.slice(0, j)); buf = buf.slice(j + 2); } pump(); };
  const onErr = (e) => { while (waiters.length) waiters.shift().reject(e); };
  sock.on('data', onData); sock.on('error', onErr);
  return {
    next: () => new Promise((resolve, reject) => { waiters.push({ resolve, reject }); pump(); }),
    detach: () => { sock.off('data', onData); sock.off('error', onErr); },
  };
}

// Opent de verbinding met de mailserver: direct TLS (standaard poort 465) of gewoon (587, daarna STARTTLS).
function connect(cfg) {
  const port = Number(cfg.port) || (cfg.security === 'tls' ? 465 : 587);
  return new Promise((resolve, reject) => {
    const opts = { host: cfg.host, port, servername: cfg.host, rejectUnauthorized: cfg.verify !== 'off' };
    const sock = cfg.security === 'tls' ? tls.connect(opts, () => resolve(sock)) : net.connect(opts, () => resolve(sock));
    sock.setTimeout(30000, () => sock.destroy(new Error('Time-out bij de mailserver')));
    sock.once('error', reject);
  });
}

// Bouwt een MIME-bericht met tekst, HTML en bijlagen.
function buildMessage({ from, to, subject, text, html, attachments = [] }) {
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  const enc = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
  const wrap = (s) => s.replace(/.{1,76}/g, '$&\r\n');
  const bMixed = 'mix_' + randomBytes(12).toString('hex'), bAlt = 'alt_' + randomBytes(12).toString('hex');
  const domain = addrOf(from).split('@')[1] || 'gymcoach.local';
  const fromName = /^(.*?)\s*</.exec(from)?.[1]?.replace(/"/g, '');
  const parts = [
    `From: ${fromName ? `${enc(fromName)} <${addrOf(from)}>` : addrOf(from)}`,
    `To: ${to}`,
    `Subject: ${enc(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${bMixed}"`,
    '',
    `--${bMixed}`,
    `Content-Type: multipart/alternative; boundary="${bAlt}"`,
    '',
    `--${bAlt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(text || '')),
    `--${bAlt}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(html || text || '')),
    `--${bAlt}--`,
  ];
  for (const a of attachments) {
    parts.push(`--${bMixed}`, `Content-Type: ${a.contentType || 'application/octet-stream'}; name="${a.filename}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${a.filename}"`, '', wrap(Buffer.from(a.content).toString('base64')));
  }
  parts.push(`--${bMixed}--`, '');
  return parts.join('\r\n');
}

// Is er genoeg ingesteld om mail te versturen?
export function isConfigured(cfg) { return !!(cfg?.host && cfg?.from); }

// certificaatfouten in gewone taal
export function explain(e, cfg = {}) {
  const m = String(e?.message || e), c = e?.code || '';
  if (/CERT_HAS_EXPIRED|certificate has expired/i.test(c + m)) return new Error(`Het SSL-certificaat van ${cfg.host} is verlopen. Vernieuw het mailcertificaat op de server (Plesk: Tools & Settings → SSL/TLS Certificates → "Certificate for securing mail"), gebruik de servernaam waarop het certificaat wél geldig is, of zet "Certificaat controleren" tijdelijk uit.`);
  if (/ERR_TLS_CERT_ALTNAME_INVALID|altnames|Hostname\/IP does not match/i.test(c + m)) return new Error(`Het certificaat van de mailserver hoort niet bij "${cfg.host}". Gebruik de naam die in het certificaat staat (vaak de servernaam, zoals mail.jouwdomein.nl), of zet "Certificaat controleren" uit.`);
  if (/SELF_SIGNED|self[- ]signed|UNABLE_TO_VERIFY|unable to verify/i.test(c + m)) return new Error(`De mailserver gebruikt een certificaat dat niet te controleren is (zelfondertekend). Installeer een geldig certificaat (bijv. Let's Encrypt) of zet "Certificaat controleren" uit.`);
  if (/ECONNREFUSED/.test(c + m)) return new Error(`Geen verbinding met ${cfg.host}:${cfg.port}. Klopt de poort (465 = TLS, 587 = STARTTLS)?`);
  if (/ENOTFOUND|EAI_AGAIN/.test(c + m)) return new Error(`Mailserver "${cfg.host}" niet gevonden. Controleer de naam.`);
  return e instanceof Error ? e : new Error(m);
}

// Verstuurt een mail; certificaatfouten krijgen een begrijpelijke uitleg.
export async function send(cfg, msg) {
  try { return await sendRaw(cfg, msg); } catch (e) { throw explain(e, cfg); }
}
// Het SMTP-gesprek zelf: EHLO, STARTTLS, AUTH, MAIL/RCPT/DATA.
async function sendRaw(cfg, msg) {
  if (!isConfigured(cfg)) throw new Error('E-mail is nog niet ingesteld (Instellingen → E-mail, beheerder)');
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(msg.to || '')) throw new Error('Geen geldig e-mailadres ingesteld');
  let sock = await connect(cfg);
  let r = reader(sock);
  const expect = async (codes, what) => {
    const res = await r.next();
    if (!codes.includes(res.code)) throw new Error(`Mailserver weigerde ${what}: ${res.text.split('\n').pop()}`);
    return res;
  };
  const cmd = async (line, codes, what) => { sock.write(line + '\r\n'); return expect(codes, what); };
  try {
    await expect([220], 'de verbinding');
    const name = os.hostname() || 'gymcoach';
    let ehlo = await cmd(`EHLO ${name}`, [250], 'EHLO');
    if (cfg.security !== 'tls' && cfg.security !== 'none') {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error('Mailserver ondersteunt geen STARTTLS; kies TLS (poort 465) of "geen"');
      await cmd('STARTTLS', [220], 'STARTTLS');
      r.detach();
      sock = await new Promise((resolve, reject) => { const t = tls.connect({ socket: sock, servername: cfg.host, rejectUnauthorized: cfg.verify !== 'off' }, () => resolve(t)); t.once('error', reject); });
      r = reader(sock);
      ehlo = await cmd(`EHLO ${name}`, [250], 'EHLO');
    }
    if (cfg.user) {
      if (/AUTH[^\n]*PLAIN/i.test(ehlo.text)) {
        await cmd(`AUTH PLAIN ${Buffer.from(`\0${cfg.user}\0${cfg.pass || ''}`).toString('base64')}`, [235], 'de inlog (controleer gebruiker en wachtwoord)');
      } else {
        await cmd('AUTH LOGIN', [334], 'AUTH LOGIN');
        await cmd(Buffer.from(cfg.user).toString('base64'), [334], 'de gebruikersnaam');
        await cmd(Buffer.from(cfg.pass || '').toString('base64'), [235], 'de inlog (controleer gebruiker en wachtwoord)');
      }
    }
    await cmd(`MAIL FROM:<${addrOf(cfg.from)}>`, [250], 'de afzender');
    await cmd(`RCPT TO:<${addrOf(msg.to)}>`, [250, 251], 'de ontvanger');
    await cmd('DATA', [354], 'DATA');
    const body = buildMessage({ ...msg, from: cfg.from }).replace(/\r\n\./g, '\r\n..');
    sock.write(body + '\r\n.\r\n');
    await expect([250], 'het bericht');
    sock.write('QUIT\r\n');
  } finally {
    setTimeout(() => sock.destroy(), 200);
  }
  return { ok: true };
}
