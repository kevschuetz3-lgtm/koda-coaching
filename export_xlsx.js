const ExcelJS = require('exceljs');
const schedData = require('./schedule_output.json');
const schedule = schedData.schedule;

function lookup(slot) { return schedule[slot] || ""; }

const DAYS = ["Mon","Tue","Wed","Thu","Fri"];

const COACH_COLORS = {
  "Kevin":    { bg: "1155CC", fg: "FFFFFF" },
  "William":  { bg: "93C47D", fg: "000000" },
  "Kaylie":   { bg: "FF00FF", fg: "FFFFFF" },
  "Tracey":   { bg: "00FFFF", fg: "000000" },
  "Riley":    { bg: "9900FF", fg: "FFFFFF" },
  "Casey":    { bg: "0C343D", fg: "FFFFFF" },
  "Elissa":   { bg: "FF9900", fg: "000000" },
  "Maggie":   { bg: "7C0303", fg: "FFFFFF" },
  "Natalie":  { bg: "FF0000", fg: "FFFFFF" },
  "Roxanne":  { bg: "F6B26B", fg: "000000" },
  "Tyler":    { bg: "FFFF00", fg: "000000" },
  "Kylie":    { bg: "BF9000", fg: "FFFFFF" },
  "Scott":    { bg: "207416", fg: "FFFFFF" },
  "Doc Em":   { bg: "AD0D5D", fg: "FFFFFF" },
  "Greg":     { bg: "4C1130", fg: "FFFFFF" },
  "Isabelle": { bg: "00FF00", fg: "000000" },
  "Emily":    { bg: "000000", fg: "FFFFFF" },
  "Jamie":    { bg: "60B0C2", fg: "000000" },
  "Jessica":  { bg: "EEA477", fg: "000000" },
  "Nate":     { bg: "D10CD0", fg: "FFFFFF" },
  "Dani":     { bg: "6B6B6B", fg: "FFFFFF" },
};

const rows = [
  {time:"5:30 AM\nSpecialty", multi:[
    {prefix:"5_30_AM_KodaShred", mask:[1,0,1,0,1], ann:"Shred"},
    {prefix:"5_30_AM_Hyrox",     mask:[0,1,0,1,0], ann:"Hyrox"}
  ], sat:{label:"6:00 AM\nHyrox", slot:"6_00_AM_Hyrox"}},
  {time:"5:00 AM",  prefix:"5_00_AM_CrossFit",  mask:[1,1,1,1,1], sat:{label:"7:00 AM", slot:"7_00_AM_CrossFit"}},
  {time:"5:30 AM",  prefix:"5_30_AM_CrossFit",  mask:[1,1,1,1,1], sat:{label:"8:00 AM", slot:"8_00_AM_CrossFit"}},
  {time:"6:00 AM",  prefix:"6_00_AM_CrossFit",  mask:[1,1,1,1,1], sat:{label:"9:00 AM", slot:"9_00_AM_CrossFit"}},
  {time:"6:30 AM",  prefix:"6_30_AM_CrossFit",  mask:[1,1,1,1,1], sat:{label:"10:00 AM", slot:"10_00_AM_CrossFit"}},
  {time:"7:45 AM",  prefix:"7_45_AM_CrossFit",  mask:[1,1,1,1,1], sat:{label:"8:00 AM\nHyrox", slot:"8_00_AM_Hyrox"}},
  {time:"8:45 AM\nKodafit", prefix:"8_45_AM_Kodafit", mask:[1,0,1,0,1], ann:"KodaFit", sat:{label:"9:00 AM\nHyrox", slot:"9_00_AM_Hyrox"}},
  {time:"9:00 AM\nHyrox",  prefix:"9_00_AM_Hyrox",   mask:[1,0,0,1,0], ann:"Hyrox", sat:{label:"12:00 PM\nKratos", slot:"12_00_PM_Kratos"}},
  {time:"7:30 AM\nWomen's", empty:true},
  {time:"8:45 AM\nWomen's", empty:true},
  {time:"9:45 AM",   prefix:"9_45_AM_CrossFit",   mask:[1,1,1,1,1]},
  {time:"11:00 AM",  prefix:"11_00_AM_CrossFit",  mask:[1,1,1,1,1]},
  {time:"12:15 PM",  prefix:"12_15_PM_CrossFit",  mask:[1,1,1,1,1]},
  {time:"Comp Class\n1:30-3 PM", empty:true},
  {time:"Kids/Teens", empty:true},
  {time:"4:00 PM\nWomen's", empty:true},
  {time:"5:00 PM\nWomen's", empty:true},
  {time:"3:30 PM",  prefix:"3_30_PM_CrossFit",  mask:[1,1,1,1,0]},
  {time:"4:00 PM",  prefix:"4_00_PM_CrossFit",  mask:[1,1,1,1,1]},
  {time:"4:30 PM",  prefix:"4_30_PM_CrossFit",  mask:[1,1,1,1,0], fri:{slot:"5_00_PM_CrossFit_Fri", label:"5:00 PM"}},
  {time:"5:15 PM",  prefix:"5_15_PM_CrossFit",  mask:[1,1,1,1,0]},
  {time:"5:45 PM",  prefix:"5_45_PM_CrossFit",  mask:[1,1,1,1,0], fri:{slot:"6_00_PM_CrossFit_Fri", label:"6:00 PM"}},
  {time:"6:30 PM",  prefix:"6_30_PM_CrossFit",  mask:[1,1,1,1,0]},
  {time:"5:15 PM\nSpecialty", prefix:"5_15_PM_KodaShred", mask:[1,0,1,0,0], ann:"Shred"},
  {time:"5:15 PM\nHyrox",     prefix:"5_15_PM_Hyrox",     mask:[0,1,0,1,0], ann:"Hyrox"},
];

async function exportSchedule() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Schedule 4-20');

  // Column widths
  ws.columns = [
    { width: 14 }, // A: Class Time
    { width: 14 }, // B: Mon
    { width: 14 }, // C: Tue
    { width: 14 }, // D: Wed
    { width: 14 }, // E: Thu
    { width: 14 }, // F: Fri
    { width: 16 }, // G: Sat
    { width: 14 }, // H: Sunday
  ];

  // Header row
  const headerData = ["4/20/2026", "Mon", "Tues", "Wed", "Thur", "Fri", "Sat", "Sunday Open\nGym"];
  const headerRow = ws.addRow(headerData);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    cell.font = { name: 'Arial', bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
  });

  // Helper: style a coach cell
  function styleCoachCell(cell, coach, annotation) {
    if (!coach) return;
    const text = annotation ? coach + "\n" + annotation : coach;
    cell.value = text;
    const colors = COACH_COLORS[coach];
    if (colors) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colors.bg } };
      cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF' + colors.fg } };
    } else {
      cell.font = { name: 'Arial', bold: true, size: 10 };
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
  }

  function thinBorder() {
    return {
      top: { style: 'thin', color: { argb: 'FFBBBBBB' } },
      bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } },
      left: { style: 'thin', color: { argb: 'FFBBBBBB' } },
      right: { style: 'thin', color: { argb: 'FFBBBBBB' } },
    };
  }

  // Data rows
  rows.forEach(row => {
    const excelRow = ws.addRow([]);

    // Time cell (column A)
    const timeCell = excelRow.getCell(1);
    timeCell.value = row.time;
    timeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    timeCell.font = { name: 'Arial', bold: true, size: 9 };
    timeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    timeCell.border = thinBorder();

    if (row.empty) {
      for (let c = 2; c <= 8; c++) {
        excelRow.getCell(c).border = thinBorder();
      }
      return;
    }

    // Weekday cells (columns B-F = 2-6)
    for (let d = 0; d < 5; d++) {
      const cell = excelRow.getCell(d + 2); // B=2, C=3, etc.
      cell.border = thinBorder();

      if (row.multi) {
        for (const s of row.multi) {
          if (s.mask[d]) {
            const coach = lookup(s.prefix + "_" + DAYS[d]);
            if (coach) { styleCoachCell(cell, coach, s.ann); break; }
          }
        }
      } else if (row.fri && d === 4) {
        const coach = lookup(row.fri.slot);
        if (coach) styleCoachCell(cell, coach, row.fri.label);
      } else if (row.mask && row.mask[d]) {
        const coach = lookup(row.prefix + "_" + DAYS[d]);
        if (coach) styleCoachCell(cell, coach, row.ann);
      }
    }

    // Saturday cell (column G = 7)
    const satCell = excelRow.getCell(7);
    satCell.border = thinBorder();
    if (row.sat) {
      const satCoach = lookup(row.sat.slot + "_Sat");
      if (satCoach) {
        const text = row.sat.label + "\n" + satCoach;
        satCell.value = text;
        const colors = COACH_COLORS[satCoach];
        if (colors) {
          satCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colors.bg } };
          satCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF' + colors.fg } };
        }
        satCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    }

    // Sunday cell (column H = 8)
    excelRow.getCell(8).border = thinBorder();
  });

  // Auto-size row heights based on content (count newlines)
  ws.eachRow(row => {
    let maxLines = 1;
    row.eachCell(cell => {
      if (cell.value) {
        const lines = String(cell.value).split('\n').length;
        if (lines > maxLines) maxLines = lines;
      }
    });
    row.height = Math.max(20, maxLines * 15);
  });

  await wb.xlsx.writeFile('./Koda_Schedule_4-27-2026.xlsx');
  console.log("Exported to Koda_Schedule_4-27-2026.xlsx");
}

exportSchedule().catch(err => console.error(err));
