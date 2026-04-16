/**
 * send_schedule_email.js
 * Builds a static HTML email from schedule_output.json and sends it
 * via the Google Apps Script backend (no credentials needed).
 *
 * Usage:
 *   node send_schedule_email.js "recipient1@email.com,recipient2@email.com" "Week of April 6"
 *
 * Defaults to kodaironview@gmail.com and riley.mcnamara@comcast.net if no args given.
 */

const https = require('https');
const http = require('http');
const out = require('./schedule_output.json');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyk14st_Ix70GM0T2I8aKRU9HRBlotk_Up-Ikh5MHxYuUdDj4xIvj36r8lvQh15gPvm/exec';

const DEFAULT_RECIPIENTS = ['kodaironview@gmail.com', 'riley.mcnamara@comcast.net'];

const recipientArg = process.argv[2];
const weekLabel = process.argv[3] || 'Next Week';
const recipients = recipientArg ? recipientArg.split(',').map(r => r.trim()) : DEFAULT_RECIPIENTS;

// ── Build static HTML schedule for email ──
const schedule = out.schedule;
const ca = out.coachAssignments;
const coaches = out.coaches;

const SCHED_COLORS = {
  Kevin: '#1155cc', William: '#93c47d', Kaylie: '#ff00ff', Tracey: '#00ffff',
  Riley: '#9900ff', Casey: '#0c343d', Elissa: '#ff9900', Maggie: '#7c0303',
  Roxanne: '#f6b26b', Tyler: '#ffff00', Scott: '#207416', 'Doc Em': '#ad0d5d',
  Greg: '#4c1130', Isabelle: '#00ff00', Jamie: '#60b0c2', Jessica: '#eea477',
  Nate: '#d10cd0', Dani: '#6b6b6b',
  Natalie: '#ff0000', Kylie: '#bf9000', Emily: '#000000'
};
const TEXT_COLORS = {
  Casey: '#fff', William: '#000', Kaylie: '#000', Tracey: '#000',
  Elissa: '#000', Roxanne: '#000', Tyler: '#000', Isabelle: '#000',
  Jamie: '#000', Jessica: '#000'
};

function coachStyle(name) {
  if (!name) return '';
  const bg = SCHED_COLORS[name] || '#eee';
  const color = TEXT_COLORS[name] || '#fff';
  return `background:${bg};color:${color};font-weight:700;padding:3px 5px;border-radius:3px;font-size:11px;`;
}

function cell(name) {
  if (!name) return '<td style="border:1px solid #ccc;padding:4px;text-align:center;font-size:11px;color:#cc0000;font-style:italic;">—</td>';
  return `<td style="border:1px solid #ccc;padding:4px;text-align:center;"><span style="${coachStyle(name)}">${name}</span></td>`;
}

function lookup(slotBase, day) {
  return schedule[`${slotBase}_${day}`] || null;
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const dayLabels = ['Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat'];

const rows = [
  { label: '5:00 AM',           base: '5_00_AM_CrossFit',  mask: [1,1,1,1,1], sat: null },
  { label: '5:30 AM KodaShred', base: '5_30_AM_KodaShred', mask: [1,0,1,0,1], sat: null },
  { label: '5:30 AM Hyrox',     base: '5_30_AM_Hyrox',     mask: [0,1,0,1,0], sat: null },
  { label: '5:30 AM',           base: '5_30_AM_CrossFit',  mask: [1,1,1,1,1], sat: null },
  { label: '6:00 AM',           base: '6_00_AM_CrossFit',  mask: [1,1,1,1,1], sat: null },
  { label: '6:30 AM',           base: '6_30_AM_CrossFit',  mask: [1,1,1,1,1], sat: null },
  { label: '7:45 AM',           base: '7_45_AM_CrossFit',  mask: [1,1,1,1,1], sat: null },
  { label: '8:45 AM Kodafit',   base: '8_45_AM_Kodafit',   mask: [1,0,1,0,1], sat: null },
  { label: '9:00 AM Hyrox',     base: '9_00_AM_Hyrox',     mask: [1,0,0,1,0], sat: null },
  { label: '9:45 AM',           base: '9_45_AM_CrossFit',  mask: [1,1,1,1,1], sat: null },
  { label: '11:00 AM',          base: '11_00_AM_CrossFit', mask: [1,1,1,1,1], sat: null },
  { label: '12:15 PM',          base: '12_15_PM_CrossFit', mask: [1,1,1,1,1], sat: null },
  { label: '3:30 PM',           base: '3_30_PM_CrossFit',  mask: [1,1,1,1,0], sat: null },
  { label: '4:00 PM',           base: '4_00_PM_CrossFit',  mask: [1,1,1,1,1], sat: null },
  { label: '4:30 PM / 5:00 PM', base: '4_30_PM_CrossFit',  mask: [1,1,1,1,0], sat: null, fri: '5_00_PM_CrossFit' },
  { label: '5:15 PM CrossFit',  base: '5_15_PM_CrossFit',  mask: [1,1,1,1,0], sat: null },
  { label: '5:15 PM KodaShred', base: '5_15_PM_KodaShred', mask: [1,0,1,0,0], sat: null },
  { label: '5:45 PM / 6:00 PM', base: '5_45_PM_CrossFit',  mask: [1,1,1,1,0], sat: null, fri: '6_00_PM_CrossFit' },
  { label: '6:30 PM',           base: '6_30_PM_CrossFit',  mask: [1,1,1,1,0], sat: null },
];

const satRows = [
  { label: '6:00 AM Hyrox', base: '6_00_AM_Hyrox_Sat' },
  { label: '7:00 AM',       base: '7_00_AM_CrossFit_Sat' },
  { label: '8:00 AM',       base: '8_00_AM_CrossFit_Sat' },
  { label: '8:00 AM Hyrox', base: '8_00_AM_Hyrox_Sat' },
  { label: '9:00 AM',       base: '9_00_AM_CrossFit_Sat' },
  { label: '9:00 AM Hyrox', base: '9_00_AM_Hyrox_Sat' },
  { label: '10:00 AM',      base: '10_00_AM_CrossFit_Sat' },
];

const thStyle = 'background:#d9e2f3;font-weight:700;border:1px solid #999;padding:5px;text-align:center;font-size:11px;';
const timeCellStyle = 'background:#f2f2f2;font-weight:700;border:1px solid #ccc;padding:4px 6px;font-size:10px;white-space:nowrap;';

let tableRows = '';
rows.forEach(row => {
  let tr = `<tr><td style="${timeCellStyle}">${row.label}</td>`;
  for (let d = 0; d < 5; d++) {
    if (!row.mask[d]) { tr += '<td style="border:1px solid #ccc;background:#f5f5f5;"></td>'; continue; }
    if (d === 4 && row.fri) {
      tr += cell(schedule[row.fri + '_Fri'] || null);
    } else {
      tr += cell(lookup(row.base, days[d]));
    }
  }
  tr += '<td style="border:1px solid #ccc;background:#f5f5f5;"></td></tr>';
  tableRows += tr;
});

// Saturday section
let satSection = `
<h3 style="margin:20px 0 8px;font-size:14px;color:#333;">Saturday</h3>
<table style="border-collapse:collapse;width:auto;">
  <thead><tr><th style="${thStyle}">Time</th><th style="${thStyle}">Coach</th></tr></thead>
  <tbody>`;
satRows.forEach(r => {
  const coach = schedule[r.base] || null;
  satSection += `<tr><td style="${timeCellStyle}">${r.label}</td>${cell(coach)}</tr>`;
});
satSection += '</tbody></table>';

// Summary table
const coachOrder = ['Riley','Jamie','Dani','Isabelle','Kevin','Greg','Elissa','Jessica','Casey','Maggie','William','Scott','Tracey','Roxanne','Kaylie','Tyler','Nate'];
let summaryRows = '';
coachOrder.forEach(c => {
  const info = coaches[c];
  if (!info) return;
  const count = (ca[c] || []).length;
  if (count === 0 && !info.isMain) return;
  const belowMin = count < info.min;
  const overMax = count > info.max;
  const flag = belowMin ? ' ⚠ BELOW MIN' : overMax ? ' (over max)' : '';
  const rowBg = belowMin ? '#fff2f2' : '';
  summaryRows += `<tr style="background:${rowBg}"><td style="padding:3px 8px;border:1px solid #ccc;font-size:11px;">${c}</td><td style="padding:3px 8px;border:1px solid #ccc;text-align:center;font-size:11px;">${count}${flag}</td><td style="padding:3px 8px;border:1px solid #ccc;text-align:center;font-size:11px;">${info.min}–${info.max}</td></tr>`;
});

const htmlBody = `
<div style="font-family:Calibri,Arial,sans-serif;max-width:800px;margin:0 auto;">
  <h2 style="text-align:center;color:#1a1a2e;margin-bottom:16px;">Koda CrossFit — Schedule ${weekLabel}</h2>

  <table style="border-collapse:collapse;width:100%;">
    <thead>
      <tr>
        <th style="${thStyle}">Time</th>
        <th style="${thStyle}">Mon</th>
        <th style="${thStyle}">Tues</th>
        <th style="${thStyle}">Wed</th>
        <th style="${thStyle}">Thur</th>
        <th style="${thStyle}">Fri</th>
        <th style="${thStyle}">Sat</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  ${satSection}

  <h3 style="margin:20px 0 8px;font-size:14px;color:#333;">Coach Totals</h3>
  <table style="border-collapse:collapse;">
    <thead><tr>
      <th style="${thStyle}">Coach</th>
      <th style="${thStyle}">Classes</th>
      <th style="${thStyle}">Range</th>
    </tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <p style="margin-top:16px;font-size:10px;color:#888;">
    Generated automatically by Koda Scheduler.
  </p>
</div>`;

// ── Load attachments as base64 ──
const fs = require('fs');
const attachments = [];
const pdfPath = './Koda_Schedule_4-20-2026.pdf';
const xlsxPath = './Koda_Schedule_4-20-2026.xlsx';
if (fs.existsSync(pdfPath)) {
  attachments.push({
    fileName: 'Koda_Schedule_4-20-2026.pdf',
    mimeType: 'application/pdf',
    data: fs.readFileSync(pdfPath).toString('base64')
  });
}
if (fs.existsSync(xlsxPath)) {
  attachments.push({
    fileName: 'Koda_Schedule_4-20-2026.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    data: fs.readFileSync(xlsxPath).toString('base64')
  });
}

// ── POST to Apps Script ──
const payload = JSON.stringify({
  action: 'sendScheduleEmail',
  recipients,
  subject: `Koda CrossFit — Schedule ${weekLabel}`,
  htmlBody,
  attachments
});

console.log(`Sending schedule to: ${recipients.join(', ')}`);

function getRedirect(url) {
  const lib = url.startsWith('https') ? https : http;
  const urlObj = new URL(url);
  const req = lib.request({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET' }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.status === 'ok') {
          console.log(`✓ Email sent to ${result.sent} recipient(s).`);
        } else {
          console.error('Error from Apps Script:', result);
        }
      } catch(e) {
        console.error('Unexpected response:', data.slice(0, 200));
      }
    });
  });
  req.on('error', err => console.error('Request error:', err));
  req.end();
}

function postWithRedirect(url, body, redirectCount = 0) {
  if (redirectCount > 5) { console.error('Too many redirects'); process.exit(1); }
  const lib = url.startsWith('https') ? https : http;
  const urlObj = new URL(url);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  const req = lib.request(options, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return getRedirect(res.headers.location);
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.status === 'ok') {
          console.log(`✓ Email sent to ${result.sent} recipient(s).`);
        } else {
          console.error('Error from Apps Script:', result);
        }
      } catch(e) {
        console.error('Unexpected response:', data.slice(0, 200));
      }
    });
  });
  req.on('error', err => console.error('Request error:', err));
  req.write(body);
  req.end();
}

postWithRedirect(APPS_SCRIPT_URL, payload);
