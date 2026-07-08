const fs = require('fs');
const out = require('./schedule_output.json');
const scheduleJSON = JSON.stringify(out.schedule);
const ca = out.coachAssignments;
const coaches = out.coaches;

const coachList = ['Riley','Jamie','Dani','Isabelle','Greg','Kevin',
  'Elissa','Jessica','Casey','Maggie','William','Scott',
  'Tracey','Roxanne','Kaylie','Tyler','Nate','Justin'];

const summaryRows = coachList.map(c => {
  const info = coaches[c];
  if (!info) return '';
  const count = (ca[c] || []).length;
  if (count === 0 && !info.isMain) return '';
  const belowMin = count < info.min;
  const overMax = count > info.max;
  const cls = belowMin ? ' class="below-min"' : '';
  const flag = belowMin ? ' ⚠' : overMax ? ' (over max)' : '';
  return `<tr><td${cls}>${c}${flag}</td><td${cls}>${count}</td><td>${info.min}-${info.max}</td></tr>`;
}).filter(Boolean).join('\n');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Koda CrossFit — Schedule 7/13/2026</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Calibri, -apple-system, sans-serif; background: #fff; color: #000; padding: 20px; font-size: 11px; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #999; padding: 4px 5px; text-align: center; vertical-align: middle; font-size: 10px; }
    th { background: #d9e2f3; font-weight: 700; font-size: 10px; }
    col.coach-col { width: 80px; } col.time-col { width: 85px; } col.day-col { width: 70px; } col.sat-col { width: 80px; }
    td.time-cell { font-weight: 700; text-align: left; padding-left: 6px; font-size: 9.5px; background: #f2f2f2; }
    td.coach-cell { font-weight: 600; font-size: 9.5px; }
    td.unfilled { color: #cc0000; font-style: italic; font-size: 8px; }
    .c-Kevin{background:#1155cc;color:#fff;} .c-William{background:#93c47d;color:#000;} .c-Kaylie{background:#ff00ff;color:#000;}
    .c-Tracey{background:#00ffff;color:#000;} .c-Riley{background:#9900ff;color:#fff;} .c-Casey{background:#0c343d;color:#fff;}
    .c-Elissa{background:#ff9900;color:#000;} .c-Maggie{background:#7c0303;color:#fff;} .c-Roxanne{background:#f6b26b;color:#000;}
    .c-Tyler{background:#ffff00;color:#000;} .c-Scott{background:#207416;color:#fff;} .c-DocEm{background:#ad0d5d;color:#fff;}
    .c-Greg{background:#4c1130;color:#fff;} .c-Isabelle{background:#00ff00;color:#000;} .c-Jamie{background:#60b0c2;color:#000;}
    .c-Jessica{background:#eea477;color:#000;} .c-Nate{background:#d10cd0;color:#fff;} .c-Dani{background:#6b6b6b;color:#fff;}
    .c-Justin{background:#1c4587;color:#fff;}
    .sched-Kevin{background:#1155cc;color:#fff;} .sched-William{background:#93c47d;color:#000;} .sched-Kaylie{background:#ff00ff;color:#000;}
    .sched-Tracey{background:#00ffff;color:#000;} .sched-Riley{background:#9900ff;color:#fff;} .sched-Casey{background:#0c343d;color:#fff;}
    .sched-Elissa{background:#ff9900;color:#000;} .sched-Maggie{background:#7c0303;color:#fff;} .sched-Roxanne{background:#f6b26b;color:#000;}
    .sched-Tyler{background:#ffff00;color:#000;} .sched-Scott{background:#207416;color:#fff;} .sched-DocEm{background:#ad0d5d;color:#fff;}
    .sched-Greg{background:#4c1130;color:#fff;} .sched-Isabelle{background:#00ff00;color:#000;} .sched-Jamie{background:#60b0c2;color:#000;}
    .sched-Jessica{background:#eea477;color:#000;} .sched-Nate{background:#d10cd0;color:#fff;} .sched-Dani{background:#6b6b6b;color:#fff;}
    .sched-Justin{background:#1c4587;color:#fff;}
    .summary { margin-top: 16px; } .summary th { font-size: 9px; } .summary td { font-size: 9px; }
    .below-min { color: #cc0000; font-weight: 700; }
    .uncovered { background:#ff0000; color:#fff; font-weight:700; }
  </style>
</head>
<body>
<h1>Koda CrossFit &mdash; Week of July 13, 2026</h1>
<table>
  <colgroup>
    <col class="coach-col"><col class="time-col"><col class="day-col"><col class="day-col">
    <col class="day-col"><col class="day-col"><col class="day-col"><col class="sat-col">
  </colgroup>
  <thead>
    <tr><th></th><th>Class Time</th><th>Mon</th><th>Tues</th><th>Wed</th><th>Thur</th><th>Fri</th><th>Sat</th></tr>
  </thead>
  <tbody id="grid"></tbody>
</table>

<script>
const schedule = ${scheduleJSON};
const SCHED = {
  "Riley":"sched-Riley","Jamie":"sched-Jamie","Dani":"sched-Dani","Isabelle":"sched-Isabelle",
  "Greg":"sched-Greg","Kevin":"sched-Kevin","Elissa":"sched-Elissa","Jessica":"sched-Jessica",
  "Casey":"sched-Casey","Maggie":"sched-Maggie","William":"sched-William","Scott":"sched-Scott",
  "Tracey":"sched-Tracey","Roxanne":"sched-Roxanne","Kaylie":"sched-Kaylie","Tyler":"sched-Tyler","Nate":"sched-Nate",
  "Justin":"sched-Justin"
};
const COACH_C = {
  "Riley":"c-Riley","Jamie":"c-Jamie","Dani":"c-Dani","Isabelle":"c-Isabelle",
  "Greg":"c-Greg","Kevin":"c-Kevin","Elissa":"c-Elissa","Jessica":"c-Jessica",
  "Casey":"c-Casey","Maggie":"c-Maggie","William":"c-William","Scott":"c-Scott",
  "Tracey":"c-Tracey","Roxanne":"c-Roxanne","Kaylie":"c-Kaylie","Tyler":"c-Tyler","Nate":"c-Nate",
  "Justin":"c-Justin"
};
const coachOrder = [
  "Riley","Jamie","Dani","Isabelle","Greg","Kevin",
  "Elissa","Jessica","Casey","Maggie","William","Scott",
  "Tracey","Roxanne","Kaylie","Tyler","Nate","Justin",""
];
const rows = [
  ["5:00 AM",            "5_00_AM_CrossFit",  [1,1,1,1,1], null, "6:00 AM\\nHyrox", "6_00_AM_Hyrox"],
  ["5:30 AM\\nHyrox",    "5_30_AM_Hyrox",     [0,1,0,1,0], null, "7:00 AM",        "7_00_AM_CrossFit"],
  ["5:30 AM",            "5_30_AM_CrossFit",  [1,1,1,1,1], null, "8:00 AM",        "8_00_AM_CrossFit"],
  ["6:00 AM",            "6_00_AM_CrossFit",  [1,1,1,1,1], null, "8:00 AM\\nHyrox","8_00_AM_Hyrox"],
  ["6:30 AM",            "6_30_AM_CrossFit",  [1,1,1,1,1], null, "9:00 AM",        "9_00_AM_CrossFit"],
  ["6:30 AM\\nHyrox",    "6_30_AM_Hyrox",     [0,1,0,1,0], null, "9:00 AM\\nHyrox","9_00_AM_Hyrox"],
  ["7:45 AM",            "7_45_AM_CrossFit",  [1,1,1,1,1], null, "10:00 AM",       "10_00_AM_CrossFit"],
  ["8:45 AM\\nKodafit",  "8_45_AM_Kodafit",   [1,0,1,0,1], null, null, null],
  ["9:00 AM\\nHyrox",    "9_00_AM_Hyrox",     [1,0,0,1,0], null, null, null],
  ["9:45 AM",            "9_45_AM_CrossFit",  [1,1,1,1,1], null, null, null],
  ["11:00 AM",           "11_00_AM_CrossFit", [1,1,1,1,1], null, null, null],
  ["12:00 PM\\nHyrox",   "12_00_PM_Hyrox",    [0,1,0,1,0], null, null, null],
  ["12:15 PM",           "12_15_PM_CrossFit", [1,1,1,1,1], null, null, null],
  ["3:30 PM",            "3_30_PM_CrossFit",  [1,1,1,1,0], null, null, null],
  ["4:00 PM",            "4_00_PM_CrossFit",  [1,1,1,1,1], null, null, null],
  ["4:30 PM",            "4_30_PM_CrossFit",  [1,1,1,1,0], "fri5", null, null],
  ["5:15 PM\\nCrossFit", "5_15_PM_CrossFit",  [1,1,1,1,0], null, null, null],
  ["5:15 PM\\nHyrox",    "5_15_PM_Hyrox",     [0,1,0,1,0], null, null, null],
  ["5:45 PM",            "5_45_PM_CrossFit",  [1,1,1,1,0], "fri6", null, null],
  ["6:30 PM",            "6_30_PM_CrossFit",  [1,1,1,1,0], null, null, null],
];
const days = ["Mon","Tue","Wed","Thu","Fri"];
const tbody = document.getElementById("grid");
function coachCell(name) {
  if (!name) return '<td class="unfilled">\u2014</td>';
  if (name === 'UNCOVERED') return '<td class="uncovered">UNCOVERED</td>';
  const cls = SCHED[name] || '';
  return '<td class="coach-cell ' + cls + '">' + name + '</td>';
}
rows.forEach((row, idx) => {
  const tr = document.createElement("tr");
  const cn = idx < coachOrder.length ? coachOrder[idx] : "";
  tr.innerHTML = cn ? '<td class="' + (COACH_C[cn]||'') + '" style="font-weight:700;font-size:9px;">' + cn + '</td>' : '<td></td>';
  tr.innerHTML += '<td class="time-cell">' + row[0].replace(/\\n/g,'<br>') + '</td>';
  const slotBase = row[1], dayMask = row[2], type = row[3];
  for (let d = 0; d < 5; d++) {
    if (type === "fri5" && d === 4) {
      const c = schedule["5_00_PM_CrossFit_Fri"];
      tr.innerHTML += c ? '<td class="coach-cell ' + (SCHED[c]||'') + '">' + c + '<br>5:00 PM</td>' : '<td class="unfilled">—</td>';
      continue;
    }
    if (type === "fri6" && d === 4) {
      const c = schedule["6_00_PM_CrossFit_Fri"];
      tr.innerHTML += c ? '<td class="coach-cell ' + (SCHED[c]||'') + '">' + c + '<br>6:00 PM</td>' : '<td class="unfilled">—</td>';
      continue;
    }
    if (!dayMask[d] || !slotBase) { tr.innerHTML += '<td></td>'; continue; }
    if (type === "sp515") {
      const isHyrox = (d === 1 || d === 3);
      const key = isHyrox ? ("5_15_PM_Hyrox_" + days[d]) : ("5_15_PM_KodaShred_" + days[d]);
      const c = schedule[key] || null;
      const lbl = isHyrox ? "Hyrox" : "Shred";
      if (!c) tr.innerHTML += '<td class="unfilled">—</td>';
      else if (c === 'UNCOVERED') tr.innerHTML += '<td class="uncovered">UNCOVERED<br>' + lbl + '</td>';
      else { const cls = SCHED[c] || ''; tr.innerHTML += '<td class="coach-cell ' + cls + '">' + c + '<br>' + lbl + '</td>'; }
    }
    else tr.innerHTML += coachCell(schedule[slotBase + "_" + days[d]] || null);
  }
  const satBase = row[5];
  tr.innerHTML += satBase ? coachCell(schedule[satBase + "_Sat"] || null) : '<td></td>';
  tbody.appendChild(tr);
});
<\/script>

<div class="summary">
<table>
  <thead><tr><th>Coach</th><th>Classes</th><th>Range</th></tr></thead>
  <tbody>${summaryRows}</tbody>
</table>
</div>
<p style="margin-top:10px;font-size:9px;color:#555;">
  Wed 5:15 PM Shred is UNCOVERED &mdash; only Jamie &amp; Isabelle submitted Wed evenings and both are fully committed to the 6 CrossFit classes there. Tracey &amp; Tyler: no availability this week (per notes); Doc Em &amp; Maggie did not submit. Riley (12) below min: only submitted Mon&ndash;Wed, so 12 is his ceiling. Dani (6) below min: Casey (priority) holds the Thu 5:00/6:00 AM pair Dani also requested. Justin gets exactly his requested back-to-back pair (Wed 11:00 + 12:15). Roxanne's only request (Wed midday) went to Greg to reach his 12-class minimum.
</p>
</body>
</html>`;

fs.writeFileSync('./schedule_7-13.html', html);
console.log('Done: schedule_7-13.html');
