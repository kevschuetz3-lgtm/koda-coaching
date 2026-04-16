/**
 * write_to_sheets.js
 * Writes the finalized schedule from schedule_output.json into Google Sheets
 * via the Apps Script backend.
 *
 * Usage:
 *   node write_to_sheets.js "2026-04-06"
 *
 * Defaults to next Monday's date if no arg given.
 */

const https = require('https');
const http = require('http');
const out = require('./schedule_output.json');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyk14st_Ix70GM0T2I8aKRU9HRBlotk_Up-Ikh5MHxYuUdDj4xIvj36r8lvQh15gPvm/exec';

const weekOf = process.argv[2] || (() => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const mon = new Date(today);
  mon.setDate(today.getDate() + diff);
  return mon.toISOString().slice(0, 10);
})();

const payload = JSON.stringify({
  action: 'writeScheduleToSheet',
  weekOf,
  schedule: out.schedule,
  coachAssignments: out.coachAssignments,
  coaches: out.coaches
});

console.log(`Writing schedule for week of ${weekOf} to Google Sheets...`);

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
          console.log(`✓ Schedule written to sheet: "${result.sheet}"`);
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
          console.log(`✓ Schedule written to sheet: "${result.sheet}"`);
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
