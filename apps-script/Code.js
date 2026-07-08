/**
 * KODA CROSSFIT — Coach Availability Backend
 *
 * SETUP:
 * 1. Go to https://script.google.com → New Project
 * 2. Paste this entire script (replace the default code)
 * 3. Click the + next to "Services" on the left sidebar
 *    → Add "Google Sheets API" (needed for spreadsheet access)
 * 4. Click Run → select "setup" from the function dropdown → Run
 *    → Authorize with your Google account when prompted
 *    → This creates the spreadsheet and sets up the weekly email reminder
 * 5. Check the Execution Log (View → Execution log) for the spreadsheet URL
 * 6. Click Deploy → New Deployment
 *    → Click the gear icon → Select "Web app"
 *    → Set "Execute as" → Me (kevschuetz3@gmail.com)
 *    → Set "Who has access" → Anyone
 *    → Click Deploy
 *    → Copy the Web App URL
 * 7. Paste that URL into index.html where it says YOUR_APPS_SCRIPT_WEB_APP_URL
 *
 * IMPORTANT: Every time you change this code, you must:
 *    Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy
 */

// ── Coach roster with emails (add emails to enable reminders) ──
var COACHES = {
  "Nate": "natemroy@gmail.com",
  "Greg": "gstrootman23@gmail.com",
  "Jessica": "jess_snapp@yahoo.com",
  "Doc Em": "upstanderchiropractic@gmail.com",
  "Casey": "caseymskram@gmail.com",
  "Maggie": "maggie.kerrigan0@gmail.com",
  "Riley": "riley.mcnamara@comcast.net",
  "Jamie": "primakow@gmail.com",
  "Dani": "danisakala0@gmail.com",
  "Isabelle": "isabellesneller@gmail.com",
  "William": "wbradley303@gmail.com",
  "Kevin": "elizabethjhesse@gmail.com",
  "Scott": "scottsneller1@gmail.com",
  "Tracey": "traceyjford@yahoo.com",
  "Elissa": "elissajmorello@gmail.com",
  "Kaylie": "kaylieee9@gmail.com",
  "Tyler": "tyler.matthew.adams@gmail.com",
  "Roxanne": "mrs.roxannelear@gmail.com",
  "Justin": "jebergh@gmail.com"
};

// ── SETUP — Run this once ──
function setup() {
  // Create or find the spreadsheet
  var ss = getOrCreateSpreadsheet();
  Logger.log("Spreadsheet URL: " + ss.getUrl());
  Logger.log("Spreadsheet ID: " + ss.getId());

  // Store the spreadsheet ID for later use
  PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());

  // Set up weekly email reminder trigger (every Tuesday at 7am)
  deleteExistingTriggers();
  ScriptApp.newTrigger("sendReminderEmails")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(7)
    .create();

  Logger.log("Setup complete! Weekly reminder trigger set for Tuesdays at 7am.");
}

function getOrCreateSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) { /* create new */ }
  }

  var ss = SpreadsheetApp.create("Koda Coach Availability");
  var sheet = ss.getActiveSheet();
  sheet.setName("Submissions");

  // Headers
  sheet.appendRow(["Timestamp", "Coach Name", "Week Of", "Notes", "Slots (comma-separated)"]);
  sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#16213e").setFontColor("#ffffff");
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 250);
  sheet.setColumnWidth(5, 800);

  return ss;
}

function deleteExistingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "sendReminderEmails") {
      ScriptApp.deleteTrigger(t);
    }
  });
}

// ── POST: Receive form submission or send schedule email ──
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── Send schedule email ──
    if (data.action === "sendScheduleEmail") {
      var recipients = data.recipients || [];
      var subject = data.subject || "Koda CrossFit — Weekly Schedule";
      var htmlBody = data.htmlBody || "";
      var attachments = [];
      if (data.attachments && data.attachments.length) {
        data.attachments.forEach(function(att) {
          attachments.push(Utilities.newBlob(
            Utilities.base64Decode(att.data),
            att.mimeType,
            att.fileName
          ));
        });
      }
      recipients.forEach(function(email) {
        var emailOpts = { to: email, subject: subject, htmlBody: htmlBody };
        if (attachments.length) emailOpts.attachments = attachments;
        MailApp.sendEmail(emailOpts);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", sent: recipients.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Delete specified tabs (with safety guard) ──
    if (data.action === "deleteTabs") {
      var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
      var ss = SpreadsheetApp.openById(id);
      var PROTECTED = { "Submissions": true };
      var requested = data.tabs || [];
      var deleted = [];
      var skipped = [];
      requested.forEach(function(name) {
        if (PROTECTED[name]) { skipped.push(name); return; }
        var sh = ss.getSheetByName(name);
        if (sh) { ss.deleteSheet(sh); deleted.push(name); }
        else { skipped.push(name); }
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", deleted: deleted, skipped: skipped }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Move a tab to first position ──
    if (data.action === "moveTabToFront") {
      var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
      var ss = SpreadsheetApp.openById(id);
      var sh = ss.getSheetByName(data.name);
      if (!sh) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Tab not found: " + data.name }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(1);
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", moved: data.name }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Create the Iron Games sponsor menu spreadsheet (data-driven) ──
    // payload: { action:"writeSponsorMenu", title, force,
    //   tabs:[{ name, note, headers:[...], rows:[[...]], widths:[...],
    //           editCols:[i,...], groupCol:i, groupColors:{val:"#hex"} }] }
    // Refuses to overwrite an existing menu sheet unless force:true
    // (the sheet is Kevin's editing surface — his edits must not be clobbered).
    if (data.action === "writeSponsorMenu") {
      var props = PropertiesService.getScriptProperties();
      var existingId = props.getProperty("SPONSOR_MENU_SHEET_ID");
      if (existingId && !data.force) {
        try {
          var ssX = SpreadsheetApp.openById(existingId);
          return ContentService.createTextOutput(JSON.stringify({ status: "exists", url: ssX.getUrl(), id: existingId }))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (eOpen) { /* stale id — fall through and create fresh */ }
      }
      var ssN = SpreadsheetApp.create(data.title || "Koda Iron Games Sponsor Menu");
      var tabs = data.tabs || [];
      for (var ti = 0; ti < tabs.length; ti++) {
        var spec = tabs[ti];
        var sh = (ti === 0) ? ssN.getSheets()[0].setName(spec.name) : ssN.insertSheet(spec.name);
        var nCols = spec.headers.length;
        var headerRow = 1;
        if (spec.note) {
          sh.getRange(1, 1).setValue(spec.note);
          sh.getRange(1, 1, 1, nCols).merge().setFontStyle("italic").setWrap(true)
            .setBackground("#fff9e6").setFontSize(9).setVerticalAlignment("middle");
          sh.setRowHeight(1, 40);
          headerRow = 2;
        }
        sh.getRange(headerRow, 1, 1, nCols).setValues([spec.headers])
          .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff").setWrap(true);
        if (spec.rows && spec.rows.length) {
          sh.getRange(headerRow + 1, 1, spec.rows.length, nCols).setValues(spec.rows)
            .setWrap(true).setVerticalAlignment("top");
          if (spec.groupCol !== undefined && spec.groupCol !== null && spec.groupColors) {
            for (var ri = 0; ri < spec.rows.length; ri++) {
              var tint = spec.groupColors[spec.rows[ri][spec.groupCol]];
              if (tint) sh.getRange(headerRow + 1 + ri, 1, 1, nCols).setBackground(tint);
            }
          }
          (spec.editCols || []).forEach(function (ci) {
            sh.getRange(headerRow + 1, ci + 1, spec.rows.length, 1).setBackground("#fff9c4");
          });
        }
        (spec.widths || []).forEach(function (w, ci) { if (w) sh.setColumnWidth(ci + 1, w); });
        sh.setFrozenRows(headerRow);
      }
      props.setProperty("SPONSOR_MENU_SHEET_ID", ssN.getId());
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", url: ssN.getUrl(), id: ssN.getId() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Generate availability tabs ──
    if (data.action === "generateAvailabilityTabs") {
      var weekOf = data.weekOf || "";
      _generateCoachTabs(weekOf);
      return ContentService.createTextOutput(JSON.stringify({status:"ok", message:"Availability tabs generated for " + weekOf}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Write individual cells to an arbitrary spreadsheet tab ──
    // payload: { action:"setCells", ssId, gid, updates:[{a1:"D2", value:5}, ...] }
    if (data.action === "setCells") {
      var ss = SpreadsheetApp.openById(data.ssId);
      var sheet = null;
      if (data.gid !== undefined && data.gid !== null && data.gid !== "") {
        var gnum = Number(data.gid);
        var all = ss.getSheets();
        for (var i = 0; i < all.length; i++) {
          if (all[i].getSheetId() === gnum) { sheet = all[i]; break; }
        }
      }
      if (!sheet) sheet = ss.getSheets()[0];
      var updates = data.updates || [];
      var written = 0;
      updates.forEach(function(u) {
        sheet.getRange(u.a1).setValue(u.value);
        written++;
      });
      return ContentService.createTextOutput(JSON.stringify({
        status: "ok", sheetName: sheet.getName(), written: written
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── Write schedule to Google Sheets ──
    if (data.action === "writeScheduleToSheet") {
      var weekOf = data.weekOf || "";
      var schedule = data.schedule || {};
      var coachAssignments = data.coachAssignments || {};
      var coaches = data.coaches || {};

      var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
      var ss = SpreadsheetApp.openById(id);

      var tabName = "Schedule " + weekOf;
      var existing = ss.getSheetByName(tabName);
      if (existing) ss.deleteSheet(existing);
      var sheet = ss.insertSheet(tabName);

      var COACH_COLORS = {
        Kevin:"#1155cc",William:"#93c47d",Kaylie:"#ff00ff",Tracey:"#00ffff",
        Riley:"#9900ff",Casey:"#0c343d",Elissa:"#ff9900",Maggie:"#7c0303",
        Roxanne:"#f6b26b",Tyler:"#ffff00",Scott:"#207416","Doc Em":"#ad0d5d",
        Greg:"#4c1130",Isabelle:"#00ff00",Jamie:"#60b0c2",Jessica:"#eea477",
        Nate:"#d10cd0",Dani:"#6b6b6b",Natalie:"#ff0000",Kylie:"#bf9000",Emily:"#000000",
        UNCOVERED:"#ff0000"
      };
      var COACH_TEXT = {
        Casey:"#ffffff",William:"#000000",Kaylie:"#000000",Tracey:"#000000",
        Elissa:"#000000",Roxanne:"#000000",Tyler:"#000000",Isabelle:"#000000",
        Jamie:"#000000",Jessica:"#000000",UNCOVERED:"#ffffff"
      };
      var DAYS = ["Mon","Tue","Wed","Thu","Fri"];

      // Row 1: header (matches 3/30 format — date in A1, day names in B1-H1)
      var hdrs = [weekOf,"Mon","Tues","Wed","Thur","Fri","Sat","Sunday Open Gym"];
      for (var h = 0; h < hdrs.length; h++) { sheet.getRange(1,h+1).setValue(hdrs[h]); }
      sheet.getRange(1,1,1,8).setFontWeight("bold").setBackground("#d9e2f3")
        .setHorizontalAlignment("center").setBorder(true,true,true,true,true,true).setFontSize(10);

      // Data rows — each: {label, type, base, mask[5], satLabel, satBase}
      // type: "cf"=regular, "sp530"=5:30AM specialty, "sp515"=5:15PM specialty,
      //       "hx515"=5:15PM Hyrox, "kf"=Kodafit, "hx"=Hyrox,
      //       "fri5"=Fri→5PM, "fri6"=Fri→6PM, "empty"=placeholder
      var DR = [
        {label:"5:30 AM Hyrox",        type:"hx",     base:"5_30_AM_Hyrox", mask:[0,1,0,1,0], satLabel:"6:00 AM Hyrox",  satBase:"6_00_AM_Hyrox_Sat"},
        {label:"5:00 AM",              type:"cf",     base:"5_00_AM_CrossFit",  mask:[1,1,1,1,1], satLabel:"7:00 AM",       satBase:"7_00_AM_CrossFit_Sat"},
        {label:"5:30 AM",              type:"cf",     base:"5_30_AM_CrossFit",  mask:[1,1,1,1,1], satLabel:"8:00 AM",       satBase:"8_00_AM_CrossFit_Sat"},
        {label:"6:00 AM",              type:"cf",     base:"6_00_AM_CrossFit",  mask:[1,1,1,1,1], satLabel:"9:00 AM",       satBase:"9_00_AM_CrossFit_Sat"},
        {label:"6:30 AM",              type:"cf",     base:"6_30_AM_CrossFit",  mask:[1,1,1,1,1], satLabel:"10:00 AM",      satBase:"10_00_AM_CrossFit_Sat"},
        {label:"6:30 AM Hyrox",        type:"hx",     base:"6_30_AM_Hyrox",     mask:[0,1,0,1,0], satLabel:null, satBase:null},
        {label:"7:45 AM",              type:"cf",     base:"7_45_AM_CrossFit",  mask:[1,1,1,1,1], satLabel:"8:00 AM Hyrox", satBase:"8_00_AM_Hyrox_Sat"},
        {label:"8:45 AM Kodafit",      type:"kf",     base:"8_45_AM_Kodafit",   mask:[1,0,1,0,1], satLabel:"9:00 AM Hyrox", satBase:"9_00_AM_Hyrox_Sat"},
        {label:"9:00 AM Hyrox",        type:"hx",     base:"9_00_AM_Hyrox",     mask:[1,0,0,1,0], satLabel:null, satBase:null},
        {label:"7:30 AM Women's",      type:"empty",  mask:[0,0,0,0,0], satLabel:null, satBase:null},
        {label:"8:45 AM Women's",      type:"empty",  mask:[0,0,0,0,0], satLabel:null, satBase:null},
        {label:"9:45 AM",              type:"cf",     base:"9_45_AM_CrossFit",  mask:[1,1,1,1,1], satLabel:null, satBase:null},
        {label:"11:00 AM",             type:"cf",     base:"11_00_AM_CrossFit", mask:[1,1,1,1,1], satLabel:null, satBase:null},
        {label:"12:00 PM Hyrox",       type:"hx",     base:"12_00_PM_Hyrox",    mask:[0,1,0,1,0], satLabel:null, satBase:null},
        {label:"12:15 PM",             type:"cf",     base:"12_15_PM_CrossFit", mask:[1,1,1,1,1], satLabel:null, satBase:null},
        {label:"Comp Class 1:30-3 PM", type:"empty",  mask:[0,0,0,0,0], satLabel:null, satBase:null},
        {label:"Kids/Teens",           type:"empty",  mask:[0,0,0,0,0], satLabel:null, satBase:null},
        {label:"4:00 PM Women's",      type:"empty",  mask:[0,0,0,0,0], satLabel:null, satBase:null},
        {label:"5:00 PM Women's",      type:"empty",  mask:[0,0,0,0,0], satLabel:null, satBase:null},
        {label:"3:30 PM",              type:"cf",     base:"3_30_PM_CrossFit",  mask:[1,1,1,1,0], satLabel:null, satBase:null},
        {label:"4:00 PM",              type:"cf",     base:"4_00_PM_CrossFit",  mask:[1,1,1,1,1], satLabel:null, satBase:null},
        {label:"4:30 PM",              type:"fri5",   base:"4_30_PM_CrossFit",  mask:[1,1,1,1,1], satLabel:null, satBase:null},
        {label:"5:15 PM",              type:"cf",     base:"5_15_PM_CrossFit",  mask:[1,1,1,1,0], satLabel:null, satBase:null},
        {label:"5:45 PM",              type:"fri6",   base:"5_45_PM_CrossFit",  mask:[1,1,1,1,1], satLabel:null, satBase:null},
        {label:"6:30 PM",              type:"cf",     base:"6_30_PM_CrossFit",  mask:[1,1,1,1,0], satLabel:null, satBase:null},
        {label:"5:15 PM Hyrox",        type:"hx",     base:"5_15_PM_Hyrox",     mask:[0,1,0,1,0], satLabel:null, satBase:null}
      ];

      for (var r = 0; r < DR.length; r++) {
        var rd = DR[r], rn = r + 2;
        sheet.getRange(rn,1).setValue(rd.label).setFontWeight("bold").setBackground("#f2f2f2").setFontSize(9).setHorizontalAlignment("center").setWrap(true);

        if (rd.type === "empty") {
          sheet.getRange(rn,2,1,7).setBackground("#f5f5f5");
          continue;
        }

        for (var d = 0; d < 5; d++) {
          var wc = sheet.getRange(rn, d+2);
          if (!rd.mask[d]) { wc.setBackground("#eeeeee"); continue; }
          var cn = null, ct = null;
          if (rd.type==="sp530") {
            if (d===1||d===3) { cn=schedule["5_30_AM_Hyrox_"+DAYS[d]]||null; if(cn)ct=cn+" Hyrox"; }
            else              { cn=schedule["5_30_AM_KodaShred_"+DAYS[d]]||null; if(cn)ct=cn+" Shred"; }
          } else if (rd.type==="sp515") {
            if (d===1||d===3) { cn=schedule["5_15_PM_Hyrox_"+DAYS[d]]||null; if(cn)ct=cn+" Hyrox"; }
            else              { cn=schedule["5_15_PM_KodaShred_"+DAYS[d]]||null; if(cn)ct=cn+" Shred"; }
          } else if (rd.type==="kf") {
            cn=schedule[rd.base+"_"+DAYS[d]]||null; if(cn)ct=cn+" KodaFit";
          } else if (rd.type==="hx") {
            cn=schedule[rd.base+"_"+DAYS[d]]||null; if(cn)ct=cn+" Hyrox";
          } else if (rd.type==="fri5" && d===4) {
            cn=schedule["5_00_PM_CrossFit_Fri"]||null; if(cn)ct="5:00 PM "+cn;
          } else if (rd.type==="fri6" && d===4) {
            cn=schedule["6_00_PM_CrossFit_Fri"]||null; if(cn)ct="6:00 PM "+cn;
          } else {
            cn=schedule[rd.base+"_"+DAYS[d]]||null; ct=cn;
          }
          if (cn) {
            wc.setValue(ct.replace(' ', '\n')).setBackground(COACH_COLORS[cn]||"#cccccc")
              .setFontColor(COACH_TEXT[cn]||"#ffffff").setFontWeight("bold")
              .setHorizontalAlignment("center").setFontSize(9).setWrap(true);
          } else { wc.setBackground("#eeeeee"); }
        }

        // Saturday (col G = 7)
        var sc2 = sheet.getRange(rn, 7);
        if (rd.satBase) {
          var scc = schedule[rd.satBase]||null;
          if (scc) {
            sc2.setValue((rd.satLabel+" "+scc).replace(' ', '\n')).setBackground(COACH_COLORS[scc]||"#cccccc")
              .setFontColor(COACH_TEXT[scc]||"#ffffff").setFontWeight("bold")
              .setHorizontalAlignment("center").setFontSize(9).setWrap(true);
          } else { sc2.setValue(rd.satLabel).setBackground("#eeeeee").setFontSize(9).setHorizontalAlignment("center"); }
        } else { sc2.setBackground("#eeeeee"); }

        sheet.getRange(rn,8).setBackground("#f9f9f9"); // Sunday col
      }

      // ── Memorial Day Mon override ──
      // If 7:00/8:30/10:00 AM Mon holiday classes are in the schedule, override the Mon column
      // (the standard grid has no rows for those times). Grey out all standard Mon cells,
      // then overlay the 3 holiday classes near the top.
      var holiday = [];
      if (schedule["7_00_AM_CrossFit_Mon"])  holiday.push({time:"7:00 AM",  coach:schedule["7_00_AM_CrossFit_Mon"]});
      if (schedule["8_30_AM_CrossFit_Mon"])  holiday.push({time:"8:30 AM",  coach:schedule["8_30_AM_CrossFit_Mon"]});
      if (schedule["10_00_AM_CrossFit_Mon"]) holiday.push({time:"10:00 AM", coach:schedule["10_00_AM_CrossFit_Mon"]});
      if (holiday.length > 0) {
        // Mark Mon header
        sheet.getRange(1, 2).setValue("Mon\n(Memorial Day)").setWrap(true);
        // Clear all standard Mon cells
        for (var rr = 0; rr < DR.length; rr++) {
          var rnn = rr + 2;
          sheet.getRange(rnn, 2).setValue("").setBackground("#f5f5f5")
            .setFontColor("#999999").setFontWeight("normal").setFontStyle("normal");
        }
        // Overlay holiday classes in the first 3 morning rows (rows 2, 3, 4 = 5:30 Specialty, 5:00 AM, 5:30 AM)
        for (var hi = 0; hi < holiday.length; hi++) {
          var hc = holiday[hi];
          var hr = hi + 2;
          sheet.getRange(hr, 2).setValue(hc.time + "\n" + hc.coach)
            .setBackground(COACH_COLORS[hc.coach] || "#cccccc")
            .setFontColor(COACH_TEXT[hc.coach] || "#ffffff")
            .setFontWeight("bold").setFontStyle("normal")
            .setHorizontalAlignment("center").setFontSize(9).setWrap(true);
        }
      }

      // Coach totals
      var coachOrder = ["Riley","Jamie","Dani","Isabelle","Kevin","Greg","Elissa","Jessica",
                        "Casey","Maggie","William","Scott","Tracey","Roxanne","Kaylie","Tyler","Nate"];
      var ts = DR.length + 3;
      sheet.getRange(ts,1).setValue("COACH TOTALS");
      sheet.getRange(ts,1,1,3).merge().setFontWeight("bold")
        .setHorizontalAlignment("center").setBackground("#1a1a2e").setFontColor("#ffffff");
      sheet.getRange(ts+1,1).setValue("Coach").setFontWeight("bold").setBackground("#d9e2f3");
      sheet.getRange(ts+1,2).setValue("Classes").setFontWeight("bold").setBackground("#d9e2f3");
      sheet.getRange(ts+1,3).setValue("Range").setFontWeight("bold").setBackground("#d9e2f3");
      var tr = ts + 2;
      for (var ci = 0; ci < coachOrder.length; ci++) {
        var cn2 = coachOrder[ci], ci2 = coaches[cn2];
        if (!ci2) continue;
        var cnt = (coachAssignments[cn2]||[]).length;
        if (cnt===0 && !ci2.isMain) continue;
        var fl = cnt<ci2.min?" \u26a0 BELOW MIN":cnt>ci2.max?" (over max)":"";
        sheet.getRange(tr,1).setValue(cn2);
        sheet.getRange(tr,2).setValue(cnt+fl);
        sheet.getRange(tr,3).setValue(ci2.min+"\u2013"+ci2.max);
        if (cnt<ci2.min) sheet.getRange(tr,1,1,3).setBackground("#fff2f2").setFontColor("#cc0000").setFontWeight("bold");
        tr++;
      }

      // Notes / tradeoffs block below coach totals
      var notes = data.notes || [];
      if (notes.length) {
        var nsRow = tr + 1;
        sheet.getRange(nsRow,1).setValue("NOTES & TRADEOFFS");
        sheet.getRange(nsRow,1,1,8).merge().setFontWeight("bold")
          .setHorizontalAlignment("center").setBackground("#1a1a2e").setFontColor("#ffffff").setFontSize(10);
        for (var ni = 0; ni < notes.length; ni++) {
          var nr = nsRow + 1 + ni;
          sheet.getRange(nr,1).setValue("• " + notes[ni]);
          sheet.getRange(nr,1,1,8).merge().setFontSize(9).setWrap(true)
            .setHorizontalAlignment("left").setVerticalAlignment("top").setBackground("#fffef5");
        }
      }

      // Column widths
      sheet.setColumnWidth(1,140);
      for (var cw=0;cw<5;cw++){sheet.setColumnWidth(cw+2,85);}
      sheet.setColumnWidth(7,140); sheet.setColumnWidth(8,120);
      sheet.getRange(1,1,DR.length+1,8).setBorder(true,true,true,true,true,true);

      return ContentService.createTextOutput(JSON.stringify({status:"ok",sheet:tabName}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
    var ss = SpreadsheetApp.openById(id);
    var sheet = ss.getSheetByName("Submissions");

    sheet.appendRow([
      new Date().toISOString(),
      data.coachName,
      data.weekOf,
      data.notes || "",
      (data.slots || []).join(", ")
    ]);

    // Send confirmation email to the coach
    var coachEmail = COACHES[data.coachName];
    if (coachEmail) {
      var slots = data.slots || [];
      var slotList = "";

      if (slots.length === 0) {
        slotList = "<p><strong>No availability submitted for this week.</strong></p>";
      } else {
        // Group slots by day
        var days = {"Mon": [], "Tue": [], "Wed": [], "Thu": [], "Fri": [], "Sat": []};
        slots.forEach(function(s) {
          var dayMatch = s.match(/_(Mon|Tue|Wed|Thu|Fri|Sat)$/);
          if (dayMatch) {
            var label = s.replace(/_(?:Mon|Tue|Wed|Thu|Fri|Sat)$/, "").replace(/_/g, " ");
            days[dayMatch[1]].push(label);
          }
        });

        var dayNames = {"Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday"};
        slotList = "<table style='border-collapse:collapse;'>";
        ["Mon","Tue","Wed","Thu","Fri","Sat"].forEach(function(day) {
          if (days[day].length > 0) {
            slotList += "<tr><td style='padding:4px 12px 4px 0;font-weight:bold;vertical-align:top;'>" +
              dayNames[day] + "</td><td style='padding:4px 0;'>" +
              days[day].join("<br>") + "</td></tr>";
          }
        });
        slotList += "</table>";
      }

      MailApp.sendEmail({
        to: coachEmail,
        subject: "Koda CrossFit — Availability Confirmed for Week of " + data.weekOf,
        htmlBody:
          "<p>Hey " + data.coachName + ",</p>" +
          "<p>Your availability for the week of <strong>" + data.weekOf + "</strong> has been submitted. Here's what you selected:</p>" +
          slotList +
          (data.notes ? "<p><strong>Notes:</strong> " + data.notes + "</p>" : "") +
          "<p>If you need to make changes, just submit the form again.</p>" +
          "<p>Thanks!</p>"
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET: Fetch last week's submission for a coach ──
function doGet(e) {
  var action = e.parameter.action;

  if (action === "getLastWeek") {
    var coach = e.parameter.coach;
    return getLastWeekData(coach);
  }

  if (action === "getAllForWeek") {
    var weekOf = e.parameter.weekOf;
    return getAllForWeek(weekOf);
  }

  if (action === "getAll") {
    return getAllSubmissions();
  }

  // ── Sponsor menu sheet info (URL/id recovery without re-creating) ──
  if (action === "sponsorMenuInfo") {
    var menuId = PropertiesService.getScriptProperties().getProperty("SPONSOR_MENU_SHEET_ID");
    if (!menuId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var menuSs = SpreadsheetApp.openById(menuId);
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", url: menuSs.getUrl(), id: menuId }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "listTabs") {
    var id = e.parameter.ssId || PropertiesService.getScriptProperties().getProperty("SHEET_ID");
    var ss = SpreadsheetApp.openById(id);
    var sheets = ss.getSheets().map(function(s) {
      return { name: s.getName(), index: s.getIndex(), rows: s.getLastRow(), gid: s.getSheetId() };
    });
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", tabs: sheets }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Read an arbitrary spreadsheet tab (by spreadsheet id + optional gid) ──
  if (action === "readSheet") {
    var ssId = e.parameter.ssId;
    var gid = e.parameter.gid;
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = null;
    if (gid !== undefined && gid !== "") {
      var gnum = Number(gid);
      var all = ss.getSheets();
      for (var i = 0; i < all.length; i++) {
        if (all[i].getSheetId() === gnum) { sheet = all[i]; break; }
      }
    }
    if (!sheet) sheet = ss.getSheets()[0];
    var values = sheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok", sheetName: sheet.getName(), gid: sheet.getSheetId(),
      rows: values.length, cols: values.length ? values[0].length : 0, values: values
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "API running" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllForWeek(weekOf) {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("Submissions");
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var rowWeek = data[i][2];
    if (rowWeek instanceof Date) {
      rowWeek = Utilities.formatDate(rowWeek, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    if (rowWeek === weekOf) {
      var slotsStr = data[i][4] || "";
      results.push({
        coach: data[i][1],
        weekOf: rowWeek,
        notes: data[i][3] || "",
        slots: slotsStr.split(", ").filter(function(s) { return s.length > 0; })
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ submissions: results }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllSubmissions() {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("Submissions");
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var rowWeek = data[i][2];
    if (rowWeek instanceof Date) {
      rowWeek = Utilities.formatDate(rowWeek, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var slotsStr = data[i][4] || "";
    results.push({
      coach: data[i][1],
      weekOf: rowWeek,
      notes: data[i][3] || "",
      slots: slotsStr.split(", ").filter(function(s) { return s.length > 0; })
    });
  }

  return ContentService.createTextOutput(JSON.stringify({ submissions: results }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getLastWeekData(coachName) {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("Submissions");
  var data = sheet.getDataRange().getValues();

  // Find the most recent submission for this coach
  var lastSubmission = null;
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === coachName) {
      lastSubmission = data[i];
      break;
    }
  }

  if (!lastSubmission) {
    return ContentService.createTextOutput(JSON.stringify({ slots: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var slotsStr = lastSubmission[4] || "";
  var slots = slotsStr.split(", ").filter(function(s) { return s.length > 0; });

  return ContentService.createTextOutput(JSON.stringify({ slots: slots }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Email Reminders ──
function sendReminderEmails() {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("Submissions");
  var data = sheet.getDataRange().getValues();

  // Figure out next Monday's date
  var today = new Date();
  var day = today.getDay();
  var diff = (day === 0) ? 1 : 8 - day;
  var nextMon = new Date(today);
  nextMon.setDate(today.getDate() + diff);
  var nextMonStr = Utilities.formatDate(nextMon, Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Find who has already submitted for next week
  var submitted = {};
  for (var i = 1; i < data.length; i++) {
    var weekOf = data[i][2];
    // Handle both date objects and strings
    if (weekOf instanceof Date) {
      weekOf = Utilities.formatDate(weekOf, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    if (weekOf === nextMonStr) {
      submitted[data[i][1]] = true;
    }
  }

  // Email coaches who haven't submitted (only if they have an email set)
  var formUrl = "https://kevschuetz3-lgtm.github.io/koda-coaching/";

  Object.keys(COACHES).forEach(function(name) {
    var email = COACHES[name];
    if (email && !submitted[name]) {
      MailApp.sendEmail({
        to: email,
        subject: "Koda CrossFit — Submit Your Availability for Next Week",
        htmlBody:
          "<p>Hey " + name + ",</p>" +
          "<p>Friendly reminder to submit your coaching availability for the week of " +
          Utilities.formatDate(nextMon, Session.getScriptTimeZone(), "MMM d, yyyy") + ". Please submit by end of day today.</p>" +
          "<p><a href='" + formUrl + "' style='background:#4ade80;color:#1a1a2e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;'>Submit Availability</a></p>" +
          "<p>Thanks!</p>"
      });
    }
  });

  Logger.log("Reminders sent. Already submitted: " + Object.keys(submitted).join(", "));
}

// ── Manual: Send reminders right now (for testing) ──
function sendRemindersNow() {
  sendReminderEmails();
}

// ── Generate per-coach visual availability tabs ──

// Time slot rows for the visual grid.
// Each entry: [display label, slot prefix, dayMask [M,T,W,Th,F,Sa]]
// dayMask: 1 = this slot exists on that day, 0 = doesn't exist
var GRID_ROWS = [
  ["5:00 AM",              "5_00_AM_CrossFit",  [1,1,1,1,1,0]],
  ["5:30 AM Hyrox",        "5_30_AM_Hyrox",     [0,1,0,1,0,0]],
  ["5:30 AM",              "5_30_AM_CrossFit",  [1,1,1,1,1,0]],
  ["6:00 AM",              "6_00_AM_CrossFit",  [1,1,1,1,1,0]],
  ["6:00 AM Hyrox",        "6_00_AM_Hyrox",     [0,0,0,0,0,1]],
  ["6:30 AM",              "6_30_AM_CrossFit",  [1,1,1,1,1,0]],
  ["6:30 AM Hyrox",        "6_30_AM_Hyrox",     [0,1,0,1,0,0]],
  ["7:00 AM",              "7_00_AM_CrossFit",  [0,0,0,0,0,1]],
  ["7:45 AM",              "7_45_AM_CrossFit",  [1,1,1,1,1,0]],
  ["8:00 AM",              "8_00_AM_CrossFit",  [0,0,0,0,0,1]],
  ["8:00 AM Hyrox",        "8_00_AM_Hyrox",     [0,0,0,0,0,1]],
  ["8:45 AM Kodafit",      "8_45_AM_Kodafit",   [1,0,1,0,1,0]],
  ["9:00 AM Hyrox",        "9_00_AM_Hyrox",     [1,0,0,1,0,1]],
  ["9:00 AM",              "9_00_AM_CrossFit",  [0,0,0,0,0,1]],
  ["9:45 AM",              "9_45_AM_CrossFit",  [1,1,1,1,1,0]],
  ["10:00 AM",             "10_00_AM_CrossFit", [0,0,0,0,0,1]],
  ["11:00 AM",             "11_00_AM_CrossFit", [1,1,1,1,1,0]],
  ["12:00 PM Hyrox",       "12_00_PM_Hyrox",    [0,1,0,1,0,0]],
  ["12:15 PM",             "12_15_PM_CrossFit", [1,1,1,1,1,0]],
  ["3:30 PM",              "3_30_PM_CrossFit",  [1,1,1,1,0,0]],
  ["4:00 PM",              "4_00_PM_CrossFit",  [1,1,1,1,1,0]],
  ["4:30 PM",              "4_30_PM_CrossFit",  [1,1,1,1,0,0]],
  ["5:00 PM",              "5_00_PM_CrossFit",  [0,0,0,0,1,0]],
  ["5:15 PM",              "5_15_PM_CrossFit",  [1,1,1,1,0,0]],
  ["5:15 PM Hyrox",        "5_15_PM_Hyrox",     [0,1,0,1,0,0]],
  ["5:45 PM",              "5_45_PM_CrossFit",  [1,1,1,1,0,0]],
  ["6:00 PM",              "6_00_PM_CrossFit",  [0,0,0,0,1,0]],
  ["6:30 PM",              "6_30_PM_CrossFit",  [1,1,1,1,0,0]]
];

var GRID_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat"];

/**
 * Generate visual availability tabs for each coach.
 *
 * To use: pick one of the two functions below and click Run.
 *   generateCoachTabs()          — auto-detects this week's Monday
 *   generateCoachTabsForWeek()   — uses WEEK_OVERRIDE below (change the date first)
 */

// ← Change this date, then run generateCoachTabsForWeek()
var WEEK_OVERRIDE = "2026-04-06";

function getNextMonday() {
  var today = new Date();
  var day = today.getDay(); // 0=Sun, 1=Mon, ...
  var daysUntilMon = (day === 0) ? 1 : 8 - day;
  var monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMon);
  return Utilities.formatDate(monday, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function generateCoachTabsForWeek() {
  _generateCoachTabs(WEEK_OVERRIDE);
}

function generateCoachTabs() {
  _generateCoachTabs(getNextMonday());
}

function _generateCoachTabs(WEEK_TO_GENERATE) {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("Submissions");
  var data = sheet.getDataRange().getValues();

  // Collect latest submission per coach for target week
  var coachSlots = {};
  var coachNotes = {};
  for (var i = 1; i < data.length; i++) {
    var rowWeek = data[i][2];
    if (rowWeek instanceof Date) {
      rowWeek = Utilities.formatDate(rowWeek, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    if (rowWeek !== WEEK_TO_GENERATE) continue;
    var name = data[i][1];
    var slotsStr = data[i][4] || "";
    var slots = slotsStr.split(", ").filter(function(s) { return s.length > 0; });
    // Always take the latest submission (overwrites earlier ones)
    coachSlots[name] = {};
    slots.forEach(function(s) { coachSlots[name][s] = true; });
    coachNotes[name] = data[i][3] || "";
  }

  // Generate a tab for each coach in the roster
  var coachNames = Object.keys(COACHES);
  for (var c = 0; c < coachNames.length; c++) {
    var coachName = coachNames[c];
    var tabName = coachName;

    // Delete existing tab if present
    var existing = ss.getSheetByName(tabName);
    if (existing) ss.deleteSheet(existing);

    var tab = ss.insertSheet(tabName);
    var available = coachSlots[coachName] || {};
    var notes = coachNotes[coachName] || "";
    var noSubmission = !coachSlots.hasOwnProperty(coachName);

    buildCoachGrid(tab, coachName, available, notes, noSubmission, WEEK_TO_GENERATE);
  }

  // Move the current week's Schedule tab to first position (fall back to Submissions)
  var frontSheet = ss.getSheetByName("Schedule " + WEEK_TO_GENERATE) || ss.getSheetByName("Submissions");
  if (frontSheet) {
    ss.setActiveSheet(frontSheet);
    ss.moveActiveSheet(1);
  }

  Logger.log("Generated availability tabs for week of " + WEEK_TO_GENERATE);
}

function buildCoachGrid(sheet, coachName, availableSlots, notes, noSubmission, weekOf) {
  // Row 1: Title
  sheet.getRange(1, 1).setValue(coachName + " — Week of " + weekOf);
  sheet.getRange(1, 1, 1, 7).merge()
    .setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center")
    .setBackground("#16213e").setFontColor("#ffffff");

  // Row 2: Notes or no-submission warning
  if (noSubmission) {
    sheet.getRange(2, 1).setValue("NO SUBMISSION");
    sheet.getRange(2, 1, 1, 7).merge()
      .setFontSize(11).setFontWeight("bold").setFontColor("#cc0000")
      .setHorizontalAlignment("center").setBackground("#fff2f2");
  } else if (notes) {
    sheet.getRange(2, 1).setValue("Notes: " + notes);
    sheet.getRange(2, 1, 1, 7).merge()
      .setFontSize(9).setFontStyle("italic").setWrap(true);
  }

  // Row 3: Day headers
  var headerRow = 3;
  sheet.getRange(headerRow, 1).setValue("Time Slot");
  for (var d = 0; d < GRID_DAYS.length; d++) {
    sheet.getRange(headerRow, d + 2).setValue(GRID_DAYS[d]);
  }
  sheet.getRange(headerRow, 1, 1, 7)
    .setFontWeight("bold").setHorizontalAlignment("center")
    .setBackground("#d9e2f3").setBorder(true, true, true, true, true, true);

  // Data rows
  var startRow = 4;
  var slotCount = 0;
  for (var r = 0; r < GRID_ROWS.length; r++) {
    var row = GRID_ROWS[r];
    var label = row[0];
    var prefix = row[1];
    var dayMask = row[2];
    var rowNum = startRow + r;

    // Check if this coach has ANY slot in this row — skip rows with no possible slots
    var hasAny = false;
    for (var d = 0; d < 6; d++) {
      if (dayMask[d]) { hasAny = true; break; }
    }
    if (!hasAny) continue;

    sheet.getRange(rowNum, 1).setValue(label)
      .setFontWeight("bold").setFontSize(9).setBackground("#f2f2f2");

    for (var d = 0; d < 6; d++) {
      var cell = sheet.getRange(rowNum, d + 2);
      if (!dayMask[d]) {
        // Slot doesn't exist on this day
        cell.setBackground("#e0e0e0");
        continue;
      }
      var slotKey = prefix + "_" + GRID_DAYS[d];
      if (availableSlots[slotKey]) {
        cell.setValue("✓").setBackground("#c6efce").setFontColor("#006100")
          .setFontWeight("bold").setHorizontalAlignment("center");
        slotCount++;
      } else {
        cell.setHorizontalAlignment("center");
      }
    }
  }

  // Summary row
  var summaryRow = startRow + GRID_ROWS.length + 1;
  sheet.getRange(summaryRow, 1).setValue("Total slots: " + slotCount)
    .setFontWeight("bold").setFontSize(10);
  sheet.getRange(summaryRow, 1, 1, 7).merge();

  // Formatting
  sheet.setColumnWidth(1, 140);
  for (var d = 0; d < 6; d++) {
    sheet.setColumnWidth(d + 2, 65);
  }
  sheet.getRange(startRow, 1, GRID_ROWS.length, 7)
    .setBorder(true, true, true, true, true, true);
}
