/**
 * generate_availability_tabs.js
 * Calls the Apps Script backend to generate per-coach availability tabs.
 *
 * Usage:
 *   node generate_availability_tabs.js "2026-04-13"
 */

const https = require('https');
const http = require('http');

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
  action: 'generateAvailabilityTabs',
  weekOf
});

console.log(`Generating availability tabs for week of ${weekOf}...`);

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
          console.log(`✓ ${result.message}`);
        } else {
          console.error('Error from Apps Script:', result);
        }
      } catch(e) {
        console.error('Unexpected response:', data.slice(0, 300));
      }
    });
  });
  req.on('error', err => console.error('Request error:', err));
  req.end();
}

function postWithRedirect(url, body) {
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
          console.log(`✓ ${result.message}`);
        } else {
          console.error('Error from Apps Script:', result);
        }
      } catch(e) {
        console.error('Unexpected response:', data.slice(0, 300));
      }
    });
  });
  req.on('error', err => console.error('Request error:', err));
  req.write(body);
  req.end();
}

postWithRedirect(APPS_SCRIPT_URL, payload);
