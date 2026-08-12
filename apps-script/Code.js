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

// ── Kevin's membership-leads spreadsheet (local trial waivers append here) ──
var WAIVER_LEADS_SHEET_ID = "1veZqZSJxUrKoAHM-5vePGfV-Fj5su4Q16L2JB9mXb-I";

// ── Coach roster with emails (add emails to enable reminders) ──
var COACHES = {
  "Nate": "natemroy@gmail.com",
  "Greg": "gstrootman23@gmail.com",
  "Jessica": "jess_snapp@yahoo.com",
  "Doc Em": "upstanderchiropractic@gmail.com",
  "Casey": "caseymskram@gmail.com",
  "Maggie": "maggie.kerrigan0@gmail.com",
  "Riley": "riley.mcnamara1@gmail.com",
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

    // ── Schedule a one-off early availability reminder ──
    if (data.action === "scheduleEarlyReminder") {
      var when = new Date(data.at);
      if (isNaN(when.getTime())) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "invalid 'at' datetime" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      ScriptApp.getProjectTriggers().forEach(function(t) {
        if (t.getHandlerFunction() === "sendEarlyReminderOneOff") ScriptApp.deleteTrigger(t);
      });
      ScriptApp.newTrigger("sendEarlyReminderOneOff").timeBased().at(when).create();
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", scheduledFor: when.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Skip the weekly reminder on one specific date (self-clearing) ──
    if (data.action === "skipNextWeeklyReminder") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.on || "")) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "invalid 'on' date (yyyy-MM-dd)" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      PropertiesService.getScriptProperties().setProperty("SKIP_WEEKLY_REMINDER_ON", data.on);
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", skipOn: data.on }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Send a test copy of the early reminder to one address ──
    if (data.action === "testEarlyReminder") {
      MailApp.sendEmail({
        to: data.to,
        subject: "[TEST] Koda CrossFit — Submit Your Availability for Next Week",
        htmlBody: buildReminderHtml_("Kevin", getNextMondayForReminder_(), EARLY_REMINDER_NOTE)
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", sentTo: data.to }))
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

    // ── Receive a sponsor quote from the Iron Games sponsor site ──
    // Logs to the "Koda Iron Games Sponsor Quotes" sheet (auto-created),
    // emails the sponsor their itemized quote, and notifies Kevin.
    if (data.action === "sponsorQuote") {
      var qProps = PropertiesService.getScriptProperties();
      var qId = qProps.getProperty("SPONSOR_QUOTES_SHEET_ID");
      var qss = null;
      if (qId) { try { qss = SpreadsheetApp.openById(qId); } catch (eQ) { qss = null; } }
      if (!qss) {
        qss = SpreadsheetApp.create("Koda Iron Games Sponsor Quotes");
        qss.getSheets()[0].setName("Quotes")
          .getRange(1, 1, 1, 14).setValues([[
            "Timestamp", "Company", "Contact", "Email", "Phone", "Bundles",
            "A-la-carte items", "Item count", "List subtotal", "Discount %",
            "Total savings", "Quoted total", "Notes", "Page"
          ]]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
        qProps.setProperty("SPONSOR_QUOTES_SHEET_ID", qss.getId());
      }
      var qsh = qss.getSheetByName("Quotes") || qss.getSheets()[0];
      qsh.appendRow([
        new Date(), data.company, data.contact, data.email, data.phone || "",
        (data.bundles || []).join("\n"), (data.items || []).join("\n"),
        data.itemCount, data.subtotal, data.discountPct, data.savings, data.total,
        data.notes || "", data.page || ""
      ]);

      var qLines = (data.bundles || []).concat(data.items || []);
      var quoteHtml =
        '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
        qLines.map(function (l) {
          return '<tr><td style="border-bottom:1px solid #ddd">' + l + '</td></tr>';
        }).join('') +
        (data.savings > 0
          ? '<tr><td style="border-bottom:1px solid #ddd;color:#b7791f">Savings: −$' +
            Number(data.savings).toLocaleString() + '</td></tr>' : '') +
        '<tr><td style="font-weight:bold;font-size:16px">Total: $' +
        Number(data.total).toLocaleString() + '</td></tr></table>';

      try {
        MailApp.sendEmail({
          to: data.email,
          replyTo: "kodaironview@gmail.com",
          subject: "Your Koda Iron Games sponsorship quote — $" + Number(data.total).toLocaleString(),
          htmlBody:
            '<p>Hi ' + data.contact + ',</p>' +
            '<p>Thanks for building a sponsorship package for the <b>Koda Iron Games</b>! Here is your quote:</p>' +
            quoteHtml +
            '<p>Kevin will reach out within 1–2 business days to finalize details and reserve your spots. ' +
            'Questions in the meantime? Just reply to this email or call/text 630-292-0725.</p>' +
            '<p>— Kevin Schuetz<br>Koda Iron Games · Presented by WODprep</p>'
        });
      } catch (eMail) { /* lead is already in the sheet — keep going */ }

      MailApp.sendEmail({
        to: "kevschuetz3@gmail.com",
        subject: "💰 New sponsor quote: " + data.company + " — $" + Number(data.total).toLocaleString(),
        htmlBody:
          '<p><b>' + data.company + '</b> just built a package on the sponsor site.</p>' +
          '<p>Contact: ' + data.contact + ' · <a href="mailto:' + data.email + '">' + data.email + '</a>' +
          (data.phone ? ' · ' + data.phone : '') + '</p>' + quoteHtml +
          (data.notes ? '<p><b>Notes:</b> ' + data.notes + '</p>' : '') +
          '<p>Logged in the "Koda Iron Games Sponsor Quotes" sheet.</p>'
      });

      return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Athlete Kits helpers (Iron Games kit builder) ──
    // Kit picks live in an "Athlete Kits" tab of the Team Kits spreadsheet,
    // whether they arrive with a full shirt submission or via the add-on link.
    function ironGamesKitsSpreadsheet_() {
      var props = PropertiesService.getScriptProperties();
      var id = props.getProperty("IRON_KIT_SHEET_ID");
      var ss = null;
      if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
      if (!ss) {
        ss = SpreadsheetApp.create("Koda Iron Games Team Kits");
        props.setProperty("IRON_KIT_SHEET_ID", ss.getId());
      }
      return ss;
    }
    function appendAthleteKits_(teamName, division, cap, kitsData, source) {
      var ss = ironGamesKitsSpreadsheet_();
      var sh = ss.getSheetByName("Athlete Kits");
      if (!sh) {
        sh = ss.insertSheet("Athlete Kits");
        sh.getRange(1, 1, 1, 10).setValues([[
          "Timestamp", "Team Name", "Division", "Captain", "Captain Email",
          "Athlete 1 Kit", "Athlete 2 Kit", "Athlete 3 Kit", "Pack Colors", "Source"
        ]]).setFontWeight("bold").setBackground("#131313").setFontColor("#ffffff");
        sh.setFrozenRows(1);
      }
      var specs = (kitsData && kitsData.specs) || [];
      sh.appendRow([
        new Date(), teamName || "", division || "", cap.name || "", cap.email || "",
        specs[0] || "", specs[1] || "", specs[2] || "",
        ((kitsData && kitsData.packColors) || []).join(","), source
      ]);
    }
    function athleteKitsHtml_(kitsData) {
      var specs = (kitsData && kitsData.specs) || [];
      if (!specs.length) return "";
      return '<p style="font-family:Arial,sans-serif;font-size:15px;margin:16px 0 4px"><b>Athlete Kits</b></p>' +
        '<table cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
        specs.map(function (s, i) {
          return '<tr><td style="border:1px solid #ddd;padding:7px;white-space:nowrap"><b>Athlete ' + (i + 1) + '</b></td>' +
            '<td style="border:1px solid #ddd;padding:7px">' + s + '</td></tr>';
        }).join('') + '</table>';
    }

    // ── Receive a team apparel kit from the Iron Games kit builder ──
    // Logs to the "Koda Iron Games Team Kits" sheet (auto-created), emails the
    // print shop (kodacustomapparel@gmail.com) the full spec + mockup images,
    // and sends the captain a confirmation copy.
    if (data.action === "ironGamesKit") {
      var kProps = PropertiesService.getScriptProperties();
      var kId = kProps.getProperty("IRON_KIT_SHEET_ID");
      var kss = null;
      if (kId) { try { kss = SpreadsheetApp.openById(kId); } catch (eK) { kss = null; } }
      if (!kss) {
        kss = SpreadsheetApp.create("Koda Iron Games Team Kits");
        kss.getSheets()[0].setName("Kits")
          .getRange(1, 1, 1, 16).setValues([[
            "Timestamp", "Division", "Team Name", "Captain", "Captain Email",
            "D1 Garment", "D1 Shirt Color", "D1 Print 1 (name/KIG26/sleeve)", "D1 Print 2 (VI/flag)", "D1 Sizes",
            "D2 Garment", "D2 Shirt Color", "D2 Print 1 (name/KIG26/sleeve)", "D2 Print 2 (VI/flag)", "D2 Sizes",
            "Page"
          ]]).setFontWeight("bold").setBackground("#131313").setFontColor("#ffffff");
        kss.getSheets()[0].setFrozenRows(1);
        kProps.setProperty("IRON_KIT_SHEET_ID", kss.getId());
      }
      var ksh = kss.getSheetByName("Kits") || kss.getSheets()[0];
      var d1 = data.day1 || {}, d2 = data.day2 || {};
      var cap = data.captain || {};
      ksh.appendRow([
        new Date(), data.division || "", data.teamName || "", cap.name || "", cap.email || "",
        d1.garment || "", d1.color || "", d1.print1 || "", d1.print2 || "", (d1.sizes || []).join(" / "),
        d2.garment || "", d2.color || "", d2.print1 || "", d2.print2 || "", (d2.sizes || []).join(" / "),
        data.page || ""
      ]);
      if (data.kits && data.kits.specs && data.kits.specs.length) {
        appendAthleteKits_(data.teamName, data.division, cap, data.kits, "with shirts");
      }

      var kitAttachments = [];
      (data.mockups || []).forEach(function (m) {
        try {
          kitAttachments.push(Utilities.newBlob(Utilities.base64Decode(m.data), m.mimeType, m.fileName));
        } catch (eB) { /* skip bad attachment */ }
      });

      function kitDayHtml(label, dd) {
        return '<tr><td style="border:1px solid #ddd;padding:8px;font-weight:bold;white-space:nowrap">' + label + '</td>' +
          '<td style="border:1px solid #ddd;padding:8px">' + (dd.color || "?") + " — " + (dd.garment || "?") + '</td>' +
          '<td style="border:1px solid #ddd;padding:8px">Print 1: <b>' + (dd.print1 || "?") + '</b><br>Print 2: <b>' + (dd.print2 || "?") + '</b></td>' +
          '<td style="border:1px solid #ddd;padding:8px">' + (dd.sizes || []).join(" / ") + '</td></tr>';
      }
      var kitTable =
        '<table cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
        '<tr><td style="border:1px solid #ddd;padding:8px;background:#f2f2f2"></td>' +
        '<td style="border:1px solid #ddd;padding:8px;background:#f2f2f2"><b>Shirt</b></td>' +
        '<td style="border:1px solid #ddd;padding:8px;background:#f2f2f2"><b>Vinyl colors</b></td>' +
        '<td style="border:1px solid #ddd;padding:8px;background:#f2f2f2"><b>Sizes</b></td></tr>' +
        kitDayHtml("Day 1", d1) + kitDayHtml("Day 2", d2) + '</table>' +
        '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">Print 1 = team name + "Koda Iron Games 26" + sleeve logo &nbsp;•&nbsp; Print 2 = VI mark/line + Colorado flag on upper back</p>' +
        athleteKitsHtml_(data.kits);

      MailApp.sendEmail({
        to: "kodacustomapparel@gmail.com",
        replyTo: cap.email || "kodaironview@gmail.com",
        subject: "👕 Iron Games team kit: " + (data.teamName || "?") + " (" + (data.division || "?") + ")",
        htmlBody:
          '<p style="font-family:Arial,sans-serif"><b>' + (data.teamName || "?") + '</b> — ' + (data.division || "?") + ' — just submitted their kit.</p>' +
          '<p style="font-family:Arial,sans-serif">Captain: ' + (cap.name || "?") + ' · <a href="mailto:' + (cap.email || "") + '">' + (cap.email || "") + '</a></p>' +
          kitTable +
          '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">Logged in the "Koda Iron Games Team Kits" sheet. Mockups attached.</p>',
        attachments: kitAttachments
      });

      if (cap.email) {
        try {
          MailApp.sendEmail({
            to: cap.email,
            replyTo: "kodacustomapparel@gmail.com",
            subject: "Your Koda Iron Games 26 team kit is locked in — " + (data.teamName || ""),
            htmlBody:
              '<p style="font-family:Arial,sans-serif">Hey ' + (cap.name || "captain") + ',</p>' +
              '<p style="font-family:Arial,sans-serif">Your team kit for <b>' + (data.teamName || "your team") + '</b> (' + (data.division || "") + ') is in the print queue for the Koda Iron Games, October 3–4. Here’s what you picked:</p>' +
              kitTable +
              '<p style="font-family:Arial,sans-serif">Mockups of both shirts are attached. Need to change anything? Email <a href="mailto:kodacustomapparel@gmail.com">kodacustomapparel@gmail.com</a> by <b>September 18</b>.</p>' +
              '<p style="font-family:Arial,sans-serif">See you on the floor,<br>Koda Iron Games • Presented by WODprep</p>',
            attachments: kitAttachments
          });
        } catch (eMail2) { /* order is already logged + sent to the shop — keep going */ }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Log a team's photo-package flash-sale answer (yes / maybe / no) ──
    // Appended to a "Photo Interest" tab in the Team Kits spreadsheet so Kevin
    // can follow up with the maybes.
    if (data.action === "ironGamesPhotoInterest") {
      var piProps = PropertiesService.getScriptProperties();
      var piId = piProps.getProperty("IRON_KIT_SHEET_ID");
      var piSs = null;
      if (piId) { try { piSs = SpreadsheetApp.openById(piId); } catch (ePi) { piSs = null; } }
      if (!piSs) {
        piSs = SpreadsheetApp.create("Koda Iron Games Team Kits");
        piProps.setProperty("IRON_KIT_SHEET_ID", piSs.getId());
      }
      var piSh = piSs.getSheetByName("Photo Interest");
      if (!piSh) {
        piSh = piSs.insertSheet("Photo Interest");
        piSh.getRange(1, 1, 1, 6).setValues([[
          "Timestamp", "Team Name", "Division", "Captain", "Captain Email", "Answer"
        ]]).setFontWeight("bold").setBackground("#131313").setFontColor("#ffffff");
        piSh.setFrozenRows(1);
      }
      var piCap = data.captain || {};
      piSh.appendRow([
        new Date(), data.teamName || "", data.division || "",
        piCap.name || "", piCap.email || "", data.choice || ""
      ]);

      // Maybe / No -> email the captain the flash-sale offer so they can convert later.
      // (Yes-clickers are already at checkout — no email.)
      if ((data.choice === "maybe" || data.choice === "no") && piCap.email) {
        try {
          MailApp.sendEmail({
            to: piCap.email,
            replyTo: "kodacustomapparel@gmail.com",
            subject: "Flash Sale: Team Photo Package — $99 for " + (data.teamName || "your team"),
            htmlBody:
              '<p style="font-family:Arial,sans-serif;font-size:30px;font-weight:bold;color:#131313;margin:0 0 14px">Flash Sale: Team Photo Package</p>' +
              '<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;margin:0 0 14px">Hey ' + (piCap.name || "captain") + ' — our professional photographers will shoot the competition floor all weekend. Lock in <b>' + (data.teamName || "your team") + '</b>’s high-res event photos at the flash price — the same package was $199 in 2025.</p>' +
              '<p style="font-family:Arial,sans-serif;margin:0 0 18px"><s style="font-size:22px;color:#888888">$199</s>&nbsp;&nbsp;<b style="font-size:40px;color:#d4291a">$99</b></p>' +
              '<a href="https://kodaironview.sites.zenplanner.com/retail-product.cfm?productId=75B7E176-C93B-44C3-B5DA-7753F1B0E5CB" style="font-family:Arial,sans-serif;display:inline-block;background:#d4291a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:12px 22px;border-radius:8px">Get the $99 package &rarr;</a>' +
              '<p style="font-family:Arial,sans-serif;font-size:12.5px;color:#777;margin:18px 0 0">Questions? Just reply to this email.<br>Koda Iron Games • Presented by WODprep</p>'
          });
        } catch (ePiMail) { /* the answer is logged either way */ }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Volunteer signup from the Iron Games volunteer site ──
    // Logs to the "Koda Iron Games Volunteers" sheet (auto-created), emails the
    // volunteer a confirmation, and notifies Kevin.
    if (data.action === "ironGamesVolunteer") {
      var vProps = PropertiesService.getScriptProperties();
      var vId = vProps.getProperty("IRON_VOLUNTEERS_SHEET_ID");
      var vss = null;
      if (vId) { try { vss = SpreadsheetApp.openById(vId); } catch (eV) { vss = null; } }
      if (!vss) {
        vss = SpreadsheetApp.create("Koda Iron Games Volunteers");
        vss.getSheets()[0].setName("Volunteers")
          .getRange(1, 1, 1, 13).setValues([[
            "Timestamp", "Name", "Email", "Phone", "Shirt Size",
            "All Weekend?", "Gift Choice", "Shifts",
            "Volunteered IG Before?", "Judged Comp Before?", "Judging Comfort (1-10)",
            "Roles", "Page"
          ]]).setFontWeight("bold").setBackground("#131313").setFontColor("#ffffff");
        vss.getSheets()[0].setFrozenRows(1);
        vProps.setProperty("IRON_VOLUNTEERS_SHEET_ID", vss.getId());
      }
      var vsh = vss.getSheetByName("Volunteers") || vss.getSheets()[0];
      vsh.appendRow([
        new Date(), data.name || "", data.email || "", data.phone || "", data.shirtSize || "",
        data.allWeekend ? "YES" : "No", data.gift || "",
        (data.shifts || []).join("\n"),
        data.volunteeredBefore || "", data.judgedBefore || "", data.judgeComfort || "",
        (data.roles || []).join("\n"),
        data.page || ""
      ]);

      function volRow(l, v) {
        return '<tr><td style="border:1px solid #ddd;padding:8px;font-weight:bold;white-space:nowrap">' + l + '</td>' +
          '<td style="border:1px solid #ddd;padding:8px">' + v + '</td></tr>';
      }
      var volTable =
        '<table cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
        volRow("Shirt size", data.shirtSize || "?") +
        volRow("Shifts", data.allWeekend
          ? '<b style="color:#b7791f">ALL WEEKEND</b><br>' + (data.shifts || []).join("<br>")
          : (data.shifts || []).join("<br>")) +
        (data.allWeekend && data.gift ? volRow("All-weekend gift", "<b>" + data.gift + "</b>") : "") +
        volRow("Roles", (data.roles || []).join("<br>")) +
        volRow("Volunteered at IG before", data.volunteeredBefore || "?") +
        volRow("Judged a comp before", data.judgedBefore || "?") +
        volRow("Judging comfort", (data.judgeComfort || "?") + " / 10") +
        '</table>';

      if (data.email) {
        try {
          MailApp.sendEmail({
            to: data.email,
            replyTo: "kodaironview@gmail.com",
            subject: "You're on the crew — Koda Iron Games 2026",
            htmlBody:
              '<p style="font-family:Arial,sans-serif">Hey ' + (data.name || "there") + ',</p>' +
              '<p style="font-family:Arial,sans-serif">Thanks for signing up to volunteer at the <b>Koda Iron Games</b>, October 3–4 at Koda CrossFit Iron View! Here\'s what you signed up for:</p>' +
              volTable +
              '<p style="font-family:Arial,sans-serif">We\'ll follow up with your shift schedule and all the details as the Games get closer. Need to change anything? Just reply to this email.</p>' +
              '<p style="font-family:Arial,sans-serif">See you on the floor,<br>Kevin Schuetz<br>Koda Iron Games • Presented by WODprep</p>'
          });
        } catch (eVMail) { /* signup is already in the sheet — keep going */ }
      }

      MailApp.sendEmail({
        to: "kevschuetz3@gmail.com",
        subject: "🙋 New Iron Games volunteer: " + (data.name || "?") +
          (data.allWeekend ? " (ALL WEEKEND)" : " (" + (data.shifts || []).length + " shift" + ((data.shifts || []).length === 1 ? "" : "s") + ")"),
        htmlBody:
          '<p style="font-family:Arial,sans-serif"><b>' + (data.name || "?") + '</b> just signed up to volunteer.</p>' +
          '<p style="font-family:Arial,sans-serif"><a href="mailto:' + (data.email || "") + '">' + (data.email || "") + '</a>' +
          (data.phone ? ' · ' + data.phone : '') + '</p>' +
          volTable +
          '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">Logged in the "Koda Iron Games Volunteers" sheet.</p>'
      });

      return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Athlete Kits ADD-ON (existing teams adding kits after the fact) ──
    // Writes ONLY to the "Athlete Kits" tab — original shirt rows are untouched.
    if (data.action === "ironGamesKitAddon") {
      var aCap = data.captain || {};
      appendAthleteKits_(data.teamName, data.division, aCap, data.kits, "add-on");
      var aHtml = athleteKitsHtml_(data.kits);
      MailApp.sendEmail({
        to: "kodacustomapparel@gmail.com",
        replyTo: aCap.email || "kodaironview@gmail.com",
        subject: "🎒 Athlete Kits added: " + (data.teamName || "?") + " (" + (data.division || "?") + ")",
        htmlBody:
          '<p style="font-family:Arial,sans-serif"><b>' + (data.teamName || "?") + '</b> — ' + (data.division || "?") +
          ' — added their Athlete Kits (shirts were ordered earlier; this is kits only).</p>' +
          '<p style="font-family:Arial,sans-serif">Captain: ' + (aCap.name || "?") + ' · <a href="mailto:' + (aCap.email || "") + '">' + (aCap.email || "") + '</a></p>' +
          aHtml +
          '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">Logged in the "Athlete Kits" tab of the Team Kits sheet.</p>'
      });
      if (aCap.email) {
        try {
          MailApp.sendEmail({
            to: aCap.email,
            replyTo: "kodacustomapparel@gmail.com",
            subject: "Your Koda Iron Games 26 Athlete Kits are locked in — " + (data.teamName || ""),
            htmlBody:
              '<p style="font-family:Arial,sans-serif">Hey ' + (aCap.name || "captain") + ',</p>' +
              '<p style="font-family:Arial,sans-serif">Your team’s Athlete Kit picks for <b>' + (data.teamName || "your team") + '</b> are in. Your shirt order from earlier is unchanged.</p>' +
              aHtml +
              '<p style="font-family:Arial,sans-serif">Need a change? Email <a href="mailto:kodacustomapparel@gmail.com">kodacustomapparel@gmail.com</a> by <b>September 18</b>.</p>' +
              '<p style="font-family:Arial,sans-serif">See you on the floor,<br>Koda Iron Games • Presented by WODprep</p>'
          });
        } catch (eAddonMail) { /* logged either way */ }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Digital waiver submission (koda-waiver site) ──
    // Logs to the "Koda CrossFit Iron View Waivers" sheet (auto-created), renders
    // a signed PDF (full waiver text + drawn signature) into the "Koda Waivers
    // (Signed PDFs)" Drive folder, emails the athlete their copy + notifies Kevin.
    // Drive save is best-effort: if the Drive scope isn't authorized yet, the
    // row still lands and the PDF still rides along as an email attachment.
    if (data.action === "waiverSubmit") {
      var wProps = PropertiesService.getScriptProperties();
      var wId = wProps.getProperty("WAIVER_SHEET_ID");
      var wss = null;
      if (wId) { try { wss = SpreadsheetApp.openById(wId); } catch (eW) { wss = null; } }
      if (!wss) {
        wss = SpreadsheetApp.create("Koda CrossFit Iron View Waivers");
        wss.getSheets()[0].setName("Waivers")
          .getRange(1, 1, 1, 14).setValues([[
            "Timestamp", "Athlete Name", "Under 18", "Parent/Guardian", "Email",
            "Referred By", "Program", "Visit Type", "From", "Duration", "Payment",
            "Date Signed", "Signed PDF", "Device"
          ]]).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
        wss.getSheets()[0].setFrozenRows(1);
        wProps.setProperty("WAIVER_SHEET_ID", wss.getId());
      }

      // Sheets created before the Program column existed: insert it after "Referred By"
      var wSheet = wss.getSheetByName("Waivers");
      var wHead = wSheet.getRange(1, 1, 1, wSheet.getLastColumn()).getValues()[0];
      if (wHead.indexOf("Program") === -1) {
        wSheet.insertColumnAfter(6);
        wSheet.getRange(1, 7).setValue("Program")
          .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      }

      // Sheets created before the out-of-town drop-in columns existed (2026-08-12):
      // insert each missing one after "Program", chaining so order is preserved
      var wVisitCols = ["Visit Type", "From", "Duration", "Payment"];
      for (var wvc = 0; wvc < wVisitCols.length; wvc++) {
        wHead = wSheet.getRange(1, 1, 1, wSheet.getLastColumn()).getValues()[0];
        if (wHead.indexOf(wVisitCols[wvc]) !== -1) continue;
        var wAfter = wHead.indexOf(wvc === 0 ? "Program" : wVisitCols[wvc - 1]) + 1; // 1-based col to insert after
        wSheet.insertColumnAfter(wAfter);
        wSheet.getRange(1, wAfter + 1).setValue(wVisitCols[wvc])
          .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      }

      var athlete = String(data.athleteName || "").trim();
      var guardian = String(data.guardianName || "").trim();
      var wMinor = !!data.isMinor;
      var wEmail = String(data.email || "").trim();
      var wReferred = String(data.referredBy || "").trim();
      var wProgram = String(data.program || "").trim();
      var wDate = String(data.dateSigned || Utilities.formatDate(new Date(), "America/Denver", "yyyy-MM-dd"));

      // Out-of-town drop-in flow (frontend 2026-08-12); locals arrive as "Local Trial Class"
      var wVisitType = String(data.visitType || "").trim();
      var wVisitFrom = String(data.visitFrom || "").trim();
      var wVisitDur = String(data.visitDuration || "").trim();
      var wVisitPay = String(data.visitPayment || "").trim();
      var wIsDropin = /drop-?in/i.test(wVisitType);
      var wVisitLine = wVisitType;
      if (wVisitFrom) wVisitLine += " — from " + wVisitFrom;
      if (wVisitDur) wVisitLine += " — " + wVisitDur;
      if (wVisitPay) wVisitLine += " — paying by " + wVisitPay;

      var pdfBlob = null, pdfUrl = "", pdfNote = "";
      try {
        var wHtml = buildWaiverPdfHtml_(athlete, wMinor, guardian, wEmail, wReferred, wProgram, wDate,
          String(data.signaturePng || ""), wVisitLine);
        pdfBlob = Utilities.newBlob(wHtml, "text/html", "waiver.html")
          .getAs("application/pdf")
          .setName("Koda Waiver - " + (athlete || "Unknown") + " - " + wDate + ".pdf");
      } catch (ePdf) { pdfNote = "PDF render failed: " + ePdf; }

      if (pdfBlob) {
        try {
          var wFolderId = wProps.getProperty("WAIVER_FOLDER_ID");
          var wFolder = null;
          if (wFolderId) { try { wFolder = DriveApp.getFolderById(wFolderId); } catch (eF) { wFolder = null; } }
          if (!wFolder) {
            wFolder = DriveApp.createFolder("Koda Waivers (Signed PDFs)");
            wProps.setProperty("WAIVER_FOLDER_ID", wFolder.getId());
          }
          pdfUrl = wFolder.createFile(pdfBlob).getUrl();
        } catch (eDrive) {
          pdfNote = "Drive save skipped (authorize Drive for this script): " + eDrive;
        }
      }

      wSheet.appendRow([
        new Date(), athlete, wMinor ? "Yes" : "", guardian, wEmail, wReferred, wProgram,
        wVisitType, wVisitFrom, wVisitDur, wVisitPay, wDate,
        pdfUrl || pdfNote, String(data.userAgent || "").slice(0, 250)
      ]);

      // Local trial-class signers are membership leads — mirror them into the leads sheet
      var wLeadNote = "";
      if (!wIsDropin) {
        try { wLeadNote = appendWaiverLead_(athlete, wEmail, wProgram, wReferred, wMinor, guardian, new Date()); }
        catch (eLead) { wLeadNote = "leads sheet update FAILED: " + eLead; }
      }

      // Kids/Teens waivers also notify the kids program coach
      var wNotifyTo = "kevschuetz3@gmail.com";
      if (/kids\s*\/?\s*teens/i.test(wProgram)) wNotifyTo += ",eacoyle@gmail.com";
      try {
        MailApp.sendEmail({
          to: wNotifyTo,
          subject: "📝 Waiver signed: " + athlete + (wProgram ? " — " + wProgram : "") +
            (wIsDropin ? " — Out-of-town drop-in" : "") + (wMinor ? " (minor)" : ""),
          htmlBody:
            '<p style="font-family:Arial,sans-serif"><b>' + escHtml_(athlete) + '</b> just signed the Koda CrossFit Iron View waiver.' +
            (wMinor ? '<br>Signed by parent/guardian: <b>' + escHtml_(guardian) + '</b>' : '') + '</p>' +
            '<p style="font-family:Arial,sans-serif">Email: <a href="mailto:' + escHtml_(wEmail) + '">' + escHtml_(wEmail) + '</a>' +
            (wProgram ? '<br>Program: <b>' + escHtml_(wProgram) + '</b>' : '') +
            (wVisitType ? '<br>Visit type: <b>' + escHtml_(wVisitType) + '</b>' : '') +
            (wVisitFrom ? '<br>From: <b>' + escHtml_(wVisitFrom) + '</b>' : '') +
            (wVisitDur ? '<br>Stay: <b>' + escHtml_(wVisitDur) + '</b>' : '') +
            (wVisitPay ? '<br>Paying by: <b>' + escHtml_(wVisitPay) + '</b>' : '') +
            (wReferred ? '<br>Referred by: ' + escHtml_(wReferred) : '') +
            (wLeadNote ? '<br>Leads sheet: ' + escHtml_(wLeadNote) : '') +
            (pdfUrl ? '<br><a href="' + pdfUrl + '">Signed PDF in Drive</a>' : (pdfNote ? '<br>' + escHtml_(pdfNote) : '')) + '</p>' +
            '<p style="font-family:Arial,sans-serif;color:#777">Logged in the "Koda CrossFit Iron View Waivers" sheet. Signed copy attached.</p>',
          attachments: pdfBlob ? [pdfBlob] : []
        });
      } catch (eN1) { /* sheet row is already in — keep going */ }

      if (wEmail) {
        // Drop-ins get a payment reminder matching what they picked on the site
        var wZen25 = "https://kodaironview.sites.zenplanner.com/retail-product.cfm?ProductId=2EE6B68B-42BF-4654-94B0-C14CA4DBB32A";
        var wZen60 = "https://kodaironview.sites.zenplanner.com/retail-product.cfm?ProductId=1237FCA9-4A10-4179-A06B-F8711918B83A";
        var wPayPara = "";
        if (wIsDropin) {
          var wPrice = /\$60/.test(wVisitDur) ? "$60" : "$25";
          if (/longer/i.test(wVisitDur)) {
            wPayPara = "Since you&#8217;re in town for more than a week, chat with us at the front desk and we&#8217;ll set you up with the membership option that fits your stay.";
          } else if (/credit card/i.test(wVisitPay)) {
            var wZenUrl = /\$60/.test(wVisitDur) ? wZen60 : wZen25;
            wPayPara = 'Drop-in payment (' + escHtml_(wVisitDur) + '): if you haven&#8217;t already, you can pay your ' + wPrice +
              ' securely here: <a href="' + wZenUrl + '">' + wZenUrl + '</a>';
          } else if (/venmo/i.test(wVisitPay)) {
            wPayPara = 'Drop-in payment (' + escHtml_(wVisitDur) + '): send ' + wPrice +
              ' on Venmo to <a href="https://venmo.com/u/kevin-schuetz-5">@kevin-schuetz-5</a> with your name in the note.';
          } else if (/zelle/i.test(wVisitPay)) {
            wPayPara = 'Drop-in payment (' + escHtml_(wVisitDur) + '): send ' + wPrice +
              ' via Zelle to kodaironview@gmail.com with your name in the memo.';
          } else if (/apparel/i.test(wVisitPay)) {
            wPayPara = "Drop-in payment: pick out $25 of Koda apparel at the front desk and your visit is covered.";
          }
        }
        try {
          MailApp.sendEmail({
            to: wEmail,
            replyTo: "kodaironview@gmail.com",
            subject: "Your signed waiver — Koda CrossFit Iron View",
            htmlBody:
              '<p style="font-family:Arial,sans-serif">Hi ' + escHtml_((wMinor && guardian ? guardian : athlete).split(" ")[0]) + ',</p>' +
              '<p style="font-family:Arial,sans-serif">Thanks for completing the Koda CrossFit Iron View waiver' +
              (wMinor ? ' on behalf of ' + escHtml_(athlete) : '') +
              '. A copy of the signed waiver is attached for your records.</p>' +
              (wPayPara ? '<p style="font-family:Arial,sans-serif">' + wPayPara + '</p>' : '') +
              '<p style="font-family:Arial,sans-serif">See you at the gym!<br>— Koda CrossFit Iron View</p>',
            attachments: pdfBlob ? [pdfBlob] : []
          });
        } catch (eN2) { /* non-fatal */ }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "ok", pdfUrl: pdfUrl, note: pdfNote }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Backfill recent waiver signers into the leads sheet ──
    // payload: { action:"backfillWaiverLeads", count:N } — takes the N most
    // recent waivers (skipping TEST rows and out-of-town drop-ins) and runs
    // them through appendWaiverLead_, same as a live local submission.
    if (data.action === "backfillWaiverLeads") {
      var bfCount = Number(data.count) || 2;
      var bfWId = PropertiesService.getScriptProperties().getProperty("WAIVER_SHEET_ID");
      var bfSh = SpreadsheetApp.openById(bfWId).getSheetByName("Waivers");
      var bfVals = bfSh.getDataRange().getValues();
      var bfDone = [];
      for (var bi = bfVals.length - 1; bi > 0 && bfDone.length < bfCount; bi--) {
        var bfR = bfVals[bi];
        var bfName = String(bfR[1] || "");
        if (!bfName || /test\s*please\s*ignore|^test\b/i.test(bfName)) continue;
        if (/drop-?in/i.test(String(bfR[7] || ""))) continue; // out-of-towners aren't membership leads
        var bfNote;
        try {
          bfNote = appendWaiverLead_(bfName, bfR[4], bfR[6], bfR[5],
            String(bfR[2] || "").toLowerCase() === "yes", bfR[3],
            bfR[0] instanceof Date ? bfR[0] : new Date());
        } catch (eBf) { bfNote = "FAILED: " + eBf; }
        bfDone.push({ name: bfName, result: bfNote });
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", processed: bfDone }))
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

    // ── Write the Iron Games kit-status report spreadsheet ──
    // payload: { action:"writeIronGamesKitStatus", title, folderName,
    //   tabs:[{ name, note, headers:[...], rows:[[...]], widths:[...],
    //           rowColors:[null|"#hex", ...] }] }
    // First run creates the file in the named Drive folder (id kept in prop
    // IRON_KIT_STATUS_SHEET_ID); later runs rewrite it in place so the URL
    // stays stable. The sheet is auto-generated — a rewrite clobbers hand edits.
    if (data.action === "writeIronGamesKitStatus") {
      var ksProps = PropertiesService.getScriptProperties();
      var ksId = ksProps.getProperty("IRON_KIT_STATUS_SHEET_ID");
      var ksSs = null;
      if (ksId) { try { ksSs = SpreadsheetApp.openById(ksId); } catch (eKsOpen) { ksSs = null; } }
      var ksCreated = false;
      var ksFolderNote = "";
      if (!ksSs) {
        ksSs = SpreadsheetApp.create(data.title || "Iron Games 2026 Kit Status");
        ksProps.setProperty("IRON_KIT_STATUS_SHEET_ID", ksSs.getId());
        ksCreated = true;
        try {
          var ksFolders = DriveApp.getFoldersByName(data.folderName || "Iron Games");
          if (ksFolders.hasNext()) {
            var ksFolder = ksFolders.next();
            DriveApp.getFileById(ksSs.getId()).moveTo(ksFolder);
            ksFolderNote = 'moved to folder "' + ksFolder.getName() + '"';
          } else {
            ksFolderNote = 'folder "' + (data.folderName || "Iron Games") + '" not found — left in My Drive root';
          }
        } catch (eKsMove) { ksFolderNote = "move failed: " + String(eKsMove); }
      }
      var ksTabs = data.tabs || [];
      var ksTmp = ksSs.insertSheet("__rebuild__");
      ksSs.getSheets().forEach(function (s) {
        if (s.getSheetId() !== ksTmp.getSheetId()) ksSs.deleteSheet(s);
      });
      for (var ksTi = 0; ksTi < ksTabs.length; ksTi++) {
        var ksSpec = ksTabs[ksTi];
        var ksSh = ksSs.insertSheet(ksSpec.name, ksTi);
        var ksCols = ksSpec.headers.length;
        var ksHeaderRow = 1;
        if (ksSpec.note) {
          ksSh.getRange(1, 1).setValue(ksSpec.note);
          ksSh.getRange(1, 1, 1, ksCols).merge().setFontStyle("italic").setWrap(true)
            .setBackground("#fff9e6").setFontSize(9).setVerticalAlignment("middle");
          ksSh.setRowHeight(1, 42);
          ksHeaderRow = 2;
        }
        ksSh.getRange(ksHeaderRow, 1, 1, ksCols).setValues([ksSpec.headers])
          .setFontWeight("bold").setBackground("#131313").setFontColor("#ffffff").setWrap(true);
        if (ksSpec.rows && ksSpec.rows.length) {
          ksSh.getRange(ksHeaderRow + 1, 1, ksSpec.rows.length, ksCols).setValues(ksSpec.rows)
            .setWrap(true).setVerticalAlignment("middle");
          (ksSpec.rowColors || []).forEach(function (hex, ri) {
            if (hex) ksSh.getRange(ksHeaderRow + 1 + ri, 1, 1, ksCols).setBackground(hex);
          });
        }
        (ksSpec.widths || []).forEach(function (w, ci) { if (w) ksSh.setColumnWidth(ci + 1, w); });
        ksSh.setFrozenRows(ksHeaderRow);
      }
      ksSs.deleteSheet(ksTmp);
      return ContentService.createTextOutput(JSON.stringify({
        status: "ok", url: ksSs.getUrl(), id: ksSs.getId(), created: ksCreated, folderNote: ksFolderNote,
        tabs: ksTabs.map(function (t) { return t.name + ":" + (t.rows || []).length; })
      })).setMimeType(ContentService.MimeType.JSON);
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

  // ── All sponsor menu tabs in one response (consumed live by the sponsor site) ──
  if (action === "sponsorMenuData") {
    var dataId = PropertiesService.getScriptProperties().getProperty("SPONSOR_MENU_SHEET_ID");
    if (!dataId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var dataSs = SpreadsheetApp.openById(dataId);
    var menuOut = { status: "ok" };
    ["Benefits", "Bundles", "Discount Ladder", "Open Questions"].forEach(function (nm) {
      var msh = dataSs.getSheetByName(nm);
      menuOut[nm] = msh ? msh.getDataRange().getValues() : [];
    });
    return ContentService.createTextOutput(JSON.stringify(menuOut))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Sponsor quotes sheet info (created on first quote submission) ──
  if (action === "sponsorQuotesInfo") {
    var quotesId = PropertiesService.getScriptProperties().getProperty("SPONSOR_QUOTES_SHEET_ID");
    if (!quotesId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var quotesSs = SpreadsheetApp.openById(quotesId);
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", url: quotesSs.getUrl(), id: quotesId }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Rebuild the "Shirt Tally" tab in the Team Kits sheet ──
  // Dedupes to each team's latest submission, tallies color×garment×size,
  // rewrites the tab, and returns the numbers. Call any time to refresh.
  if (action === "ironGamesShirtTally") {
    var tallyId = PropertiesService.getScriptProperties().getProperty("IRON_KIT_SHEET_ID");
    if (!tallyId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var tSs = SpreadsheetApp.openById(tallyId);
    var kitsSh2 = tSs.getSheetByName("Kits") || tSs.getSheets()[0];
    var vals = kitsSh2.getDataRange().getValues();
    var thead = vals[0];
    function tCol(p) {
      for (var i = 0; i < thead.length; i++) {
        if (String(thead[i]).toLowerCase().indexOf(p.toLowerCase()) === 0) return i;
      }
      return -1;
    }
    var tTeam = tCol("Team Name"), tDiv = tCol("Division");
    var tCols = [
      { g: tCol("D1 Garment"), c: tCol("D1 Shirt Color"), s: tCol("D1 Sizes") },
      { g: tCol("D2 Garment"), c: tCol("D2 Shirt Color"), s: tCol("D2 Sizes") }
    ];
    var byTeam = {}, teamOrder = [];
    for (var vr = 1; vr < vals.length; vr++) {
      var vrow = vals[vr];
      var vteam = String(vrow[tTeam] || "");
      if (!vteam || /test/i.test(vteam)) continue;
      var vkey = vteam + "§" + vrow[tDiv];
      if (!(vkey in byTeam)) teamOrder.push(vkey);
      byTeam[vkey] = vrow;   // later row wins
    }
    var T_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
    var tTally = {}, tGrand = 0;
    teamOrder.forEach(function (vkey) {
      var row = byTeam[vkey];
      tCols.forEach(function (cn) {
        var g = String(row[cn.g] || "").replace("Bella+Canvas ", "");
        var c = String(row[cn.c] || "");
        var k2 = c + "|" + g;
        if (!tTally[k2]) tTally[k2] = { c: c, g: g, total: 0, sizes: {} };
        String(row[cn.s] || "").split("/").forEach(function (t) {
          t = t.trim().toUpperCase();
          if (!t) return;
          tTally[k2].sizes[t] = (tTally[k2].sizes[t] || 0) + 1;
          tTally[k2].total++; tGrand++;
        });
      });
    });
    var tList = Object.keys(tTally).map(function (k2) { return tTally[k2]; })
      .sort(function (a, b) { return b.total - a.total; });
    var tallySh = tSs.getSheetByName("Shirt Tally");
    if (!tallySh) tallySh = tSs.insertSheet("Shirt Tally"); else tallySh.clear();
    var out = [
      ["Shirt Tally — refreshed " + Utilities.formatDate(new Date(), "America/Denver", "M/d/yyyy h:mm a") +
        " — latest submission per team (" + teamOrder.length + " teams, " + tGrand + " shirts)", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", ""],
      ["Shirt Color", "Garment", "XS", "S", "M", "L", "XL", "XXL", "Total"]
    ];
    var tSizeTotals = {};
    tList.forEach(function (t3) {
      var r3 = [t3.c, t3.g];
      T_SIZES.forEach(function (s) { r3.push(t3.sizes[s] || 0); tSizeTotals[s] = (tSizeTotals[s] || 0) + (t3.sizes[s] || 0); });
      r3.push(t3.total);
      out.push(r3);
    });
    var tTotRow = ["TOTAL", ""];
    T_SIZES.forEach(function (s) { tTotRow.push(tSizeTotals[s] || 0); });
    tTotRow.push(tGrand);
    out.push(tTotRow);
    tallySh.getRange(1, 1, out.length, 9).setValues(out);
    tallySh.getRange(1, 1).setFontWeight("bold");
    tallySh.getRange(3, 1, 1, 9).setFontWeight("bold").setBackground("#131313").setFontColor("#ffffff");
    tallySh.getRange(out.length, 1, 1, 9).setFontWeight("bold").setBackground("#f2f2f2");
    tallySh.setFrozenRows(3);
    tallySh.autoResizeColumns(1, 9);
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok", teams: teamOrder.length, shirts: tGrand, styles: tList.length, url: tSs.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── Athlete-kit pack-color tallies (drives sold-out logic on the site) ──
  if (action === "ironGamesKitCounts") {
    var kcId = PropertiesService.getScriptProperties().getProperty("IRON_KIT_SHEET_ID");
    var kcCounts = {};
    if (kcId) {
      try {
        var kcSh = SpreadsheetApp.openById(kcId).getSheetByName("Athlete Kits");
        if (kcSh && kcSh.getLastRow() > 1) {
          var kcVals = kcSh.getRange(2, 2, kcSh.getLastRow() - 1, 8).getValues(); // Team..Pack Colors
          kcVals.forEach(function (r) {
            if (/test/i.test(String(r[0] || ""))) return; // skip TEST teams
            String(r[7] || "").split(",").forEach(function (c) {
              c = c.trim();
              if (c) kcCounts[c] = (kcCounts[c] || 0) + 1;
            });
          });
        }
      } catch (eKc) {}
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", counts: kcCounts }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Team list for the kit add-on picker (deduped latest-first submissions) ──
  if (action === "ironGamesTeams") {
    var tlId = PropertiesService.getScriptProperties().getProperty("IRON_KIT_SHEET_ID");
    var tlOut = [];
    if (tlId) {
      try {
        var tlSs = SpreadsheetApp.openById(tlId);
        var tlSh = tlSs.getSheetByName("Kits") || tlSs.getSheets()[0];
        var tlVals = tlSh.getDataRange().getValues();
        var seen = {};
        var kitsDone = {};
        var akSh = tlSs.getSheetByName("Athlete Kits");
        if (akSh && akSh.getLastRow() > 1) {
          akSh.getRange(2, 2, akSh.getLastRow() - 1, 2).getValues().forEach(function (r) {
            kitsDone[String(r[0]) + "§" + String(r[1])] = true;
          });
        }
        for (var ti = 1; ti < tlVals.length; ti++) {
          var tTeam = String(tlVals[ti][2] || "");
          var tDiv = String(tlVals[ti][1] || "");
          if (!tTeam || /test/i.test(tTeam)) continue;
          var tKey = tTeam + "§" + tDiv;
          if (seen[tKey]) continue;
          seen[tKey] = true;
          tlOut.push({ team: tTeam, division: tDiv, hasKits: !!kitsDone[tKey] });
        }
      } catch (eTl) {}
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", teams: tlOut }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Team kits sheet info (created on first kit submission) ──
  if (action === "ironGamesKitsInfo") {
    var kitsId = PropertiesService.getScriptProperties().getProperty("IRON_KIT_SHEET_ID");
    if (!kitsId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var kitsSs = SpreadsheetApp.openById(kitsId);
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", url: kitsSs.getUrl(), id: kitsId }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Raw kit rows (feeds the kit-status cross-reference) ──
  if (action === "ironGamesKitRows") {
    var krId = PropertiesService.getScriptProperties().getProperty("IRON_KIT_SHEET_ID");
    var krOut = { status: "ok", kits: [], athleteKits: [] };
    if (krId) {
      try {
        var krSs = SpreadsheetApp.openById(krId);
        var krSh = krSs.getSheetByName("Kits") || krSs.getSheets()[0];
        var krVals = krSh.getDataRange().getValues();
        for (var kri = 1; kri < krVals.length; kri++) {
          krOut.kits.push({
            ts: krVals[kri][0] ? Utilities.formatDate(new Date(krVals[kri][0]), "America/Denver", "yyyy-MM-dd") : "",
            division: String(krVals[kri][1] || ""),
            team: String(krVals[kri][2] || ""),
            captain: String(krVals[kri][3] || ""),
            email: String(krVals[kri][4] || "")
          });
        }
        var krAk = krSs.getSheetByName("Athlete Kits");
        if (krAk && krAk.getLastRow() > 1) {
          var krAkVals = krAk.getDataRange().getValues();
          for (var krAi = 1; krAi < krAkVals.length; krAi++) {
            krOut.athleteKits.push({
              ts: krAkVals[krAi][0] ? Utilities.formatDate(new Date(krAkVals[krAi][0]), "America/Denver", "yyyy-MM-dd") : "",
              team: String(krAkVals[krAi][1] || ""),
              division: String(krAkVals[krAi][2] || "")
            });
          }
        }
      } catch (eKr) { krOut.status = "error"; krOut.message = String(eKr); }
    }
    return ContentService.createTextOutput(JSON.stringify(krOut))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Volunteers sheet info (created on first volunteer signup) ──
  if (action === "ironGamesVolunteersInfo") {
    var volId = PropertiesService.getScriptProperties().getProperty("IRON_VOLUNTEERS_SHEET_ID");
    if (!volId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var volSs = SpreadsheetApp.openById(volId);
    var volSheet = volSs.getSheetByName("Volunteers") || volSs.getSheets()[0];
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok", url: volSs.getUrl(), id: volId,
      count: Math.max(0, volSheet.getLastRow() - 1)
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── Waivers sheet/folder info (created on first waiver submission) ──
  if (action === "waiversInfo") {
    var wvProps = PropertiesService.getScriptProperties();
    var wvId = wvProps.getProperty("WAIVER_SHEET_ID");
    var wvFolder = wvProps.getProperty("WAIVER_FOLDER_ID");
    if (!wvId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "missing" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var wvSs = SpreadsheetApp.openById(wvId);
    var wvSheet = wvSs.getSheetByName("Waivers") || wvSs.getSheets()[0];
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok", url: wvSs.getUrl(), id: wvId,
      count: Math.max(0, wvSheet.getLastRow() - 1),
      folderUrl: wvFolder ? "https://drive.google.com/drive/folders/" + wvFolder : ""
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── Leads-sheet structure + recent waivers, PII-masked (integration scaffolding) ──
  if (action === "waiverLeadsInfo") {
    function mask_(v) {
      return String(v || "")
        .replace(/([A-Za-z0-9._%+-]{1,3})[A-Za-z0-9._%+-]*(@[^\s]+)/g, "$1…$2")
        .replace(/\d(?=\d{4})/g, "*");
    }
    var liOut = { status: "ok" };
    var liSs = SpreadsheetApp.openById(WAIVER_LEADS_SHEET_ID);
    var liSh = null;
    liSs.getSheets().forEach(function (s) { if (s.getSheetId() === 0) liSh = s; });
    liSh = liSh || liSs.getSheets()[0];
    var liLast = liSh.getLastRow(), liCols = liSh.getLastColumn();
    liOut.leads = {
      tab: liSh.getName(), rows: Math.max(0, liLast - 1), cols: liCols,
      tabs: liSs.getSheets().map(function (s) { return s.getName() + " (gid " + s.getSheetId() + ", " + s.getLastRow() + "r)"; }),
      headers: liCols ? liSh.getRange(1, 1, 1, liCols).getValues()[0] : [],
      lastRows: liLast > 1 ? liSh.getRange(Math.max(2, liLast - 1), 1, Math.min(2, liLast - 1), liCols).getValues()
        .map(function (r) { return r.map(mask_); }) : []
    };
    var liWId = PropertiesService.getScriptProperties().getProperty("WAIVER_SHEET_ID");
    if (liWId) {
      var liW = SpreadsheetApp.openById(liWId).getSheetByName("Waivers");
      var liWLast = liW.getLastRow(), liWCols = liW.getLastColumn();
      liOut.waivers = {
        rows: Math.max(0, liWLast - 1),
        headers: liW.getRange(1, 1, 1, liWCols).getValues()[0],
        lastRows: liWLast > 1 ? liW.getRange(Math.max(2, liWLast - 3), 1, Math.min(4, liWLast - 1), liWCols).getValues()
          .map(function (r) { return r.map(mask_); }) : []
      };
    }
    return ContentService.createTextOutput(JSON.stringify(liOut))
      .setMimeType(ContentService.MimeType.JSON);
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
var EARLY_REMINDER_NOTE =
  "<p><b>Heads up:</b> this week's availability reminder is going out a couple of days earlier " +
  "than usual so next week's schedule can be sent out earlier.</p>";

function getNextMondayForReminder_() {
  // The Monday of the week being scheduled next. On Sunday this is the Monday
  // 8 days out — the week starting tomorrow is already scheduled.
  var today = new Date();
  var day = today.getDay();
  var diff = (day === 0) ? 8 : 8 - day;
  var nextMon = new Date(today);
  nextMon.setDate(today.getDate() + diff);
  return nextMon;
}

function buildReminderHtml_(name, nextMon, extraNote) {
  var formUrl = "https://kevschuetz3-lgtm.github.io/koda-coaching/";
  return "<p>Hey " + name + ",</p>" +
    (extraNote || "") +
    "<p>Friendly reminder to submit your coaching availability for the week of " +
    Utilities.formatDate(nextMon, Session.getScriptTimeZone(), "MMM d, yyyy") + ". Please submit by end of day today.</p>" +
    "<p><a href='" + formUrl + "' style='background:#4ade80;color:#1a1a2e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;'>Submit Availability</a></p>" +
    "<p>Thanks!</p>";
}

function sendReminderCore_(extraNote) {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName("Submissions");
  var data = sheet.getDataRange().getValues();

  var nextMon = getNextMondayForReminder_();
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
  Object.keys(COACHES).forEach(function(name) {
    var email = COACHES[name];
    if (email && !submitted[name]) {
      MailApp.sendEmail({
        to: email,
        subject: "Koda CrossFit — Submit Your Availability for Next Week",
        htmlBody: buildReminderHtml_(name, nextMon, extraNote)
      });
    }
  });

  Logger.log("Reminders sent. Already submitted: " + Object.keys(submitted).join(", "));
}

function sendReminderEmails() {
  // One-time skip support: if SKIP_WEEKLY_REMINDER_ON matches today, skip this
  // run and clear the flag so the normal weekly schedule resumes by itself.
  var props = PropertiesService.getScriptProperties();
  var skipOn = props.getProperty("SKIP_WEEKLY_REMINDER_ON"); // yyyy-MM-dd
  if (skipOn) {
    var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (todayStr === skipOn) {
      props.deleteProperty("SKIP_WEEKLY_REMINDER_ON");
      Logger.log("Weekly reminder skipped (one-time skip for " + skipOn + ")");
      return;
    }
    if (todayStr > skipOn) props.deleteProperty("SKIP_WEEKLY_REMINDER_ON"); // stale flag
  }
  sendReminderCore_(null);
}

// One-off early reminder — created via doPost {action:'scheduleEarlyReminder'};
// deletes its own trigger(s) so it only ever fires once.
function sendEarlyReminderOneOff() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "sendEarlyReminderOneOff") ScriptApp.deleteTrigger(t);
  });
  sendReminderCore_(EARLY_REMINDER_NOTE);
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

// ══════════════ Digital waiver helpers ══════════════

function escHtml_(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Renders the signed waiver as print-ready HTML (converted to PDF by the caller).
// Mirrors the paper "Koda CrossFit Iron View Digital Waiver" text verbatim.
// Append a local trial-class waiver signer to Kevin's membership-leads sheet
// (gid 0 = "2025 Master List"). Dedupes by email; returns a short note for the
// notification email. Columns: Stage, First, Last, Email, Phone, Notes,
// Interaction Owner/Date, Contact Method, Track Interest, Column 1.
function appendWaiverLead_(athlete, email, program, referred, isMinor, guardian, when) {
  var ss = SpreadsheetApp.openById(WAIVER_LEADS_SHEET_ID);
  var sh = null;
  ss.getSheets().forEach(function (s) { if (s.getSheetId() === 0) sh = s; });
  sh = sh || ss.getSheets()[0];
  var emailLc = String(email || "").trim().toLowerCase();
  if (emailLc && sh.getLastRow() > 1) {
    var emails = sh.getRange(2, 4, sh.getLastRow() - 1, 1).getValues(); // col D = Email
    for (var i = 0; i < emails.length; i++) {
      if (String(emails[i][0] || "").trim().toLowerCase() === emailLc) {
        return "already in leads sheet (row " + (i + 2) + ") — no new row added";
      }
    }
  }
  var parts = String(athlete || "").trim().split(/\s+/);
  var first = parts.shift() || "";
  var last = parts.join(" ");
  var notes = "Signed digital waiver" + (program ? " — interested in " + program : "") +
    (referred ? ". Referred by: " + referred : "") +
    (isMinor && guardian ? ". Under 18 — parent/guardian: " + guardian : "") + ".";
  sh.appendRow([
    "New lead (waiver)", first, last, String(email || ""), "", notes,
    when || new Date(), "Digital Waiver", program || "", ""
  ]);
  return "added to leads sheet (row " + sh.getLastRow() + ")";
}

function buildWaiverPdfHtml_(athlete, isMinor, guardian, email, referredBy, program, dateSigned, sigB64, visitLine) {
  var recorded = Utilities.formatDate(new Date(), "America/Denver", "MMMM d, yyyy h:mm a") + " Mountain Time";
  var sigImg = sigB64
    ? '<img src="data:image/png;base64,' + sigB64 + '" style="height:58px" alt="signature">'
    : '<span style="color:#999">[no signature image]</span>';

  return '' +
    '<html><head><meta charset="UTF-8"><style>' +
    '@page { size: Letter; margin: 0.7in 0.75in; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 10.3pt; color: #111; line-height: 1.45; }' +
    'h1 { font-size: 13.5pt; text-align: center; margin: 0 0 10px; }' +
    'h2 { font-size: 11pt; text-align: center; margin: 14px 0 6px; }' +
    'p { margin: 0 0 8px; }' +
    '.caps { font-weight: bold; }' +
    'td { vertical-align: bottom; font-size: 9.5pt; }' +
    '.sigline { border-top: 1px solid #111; padding-top: 3px; }' +
    '.meta { color: #555; font-size: 8.5pt; margin-top: 16px; text-align: center; }' +
    '</style></head><body>' +
    '<h1>Koda CrossFit Iron View Waiver and Release</h1>' +
    '<p>This form is an important legal document. It explains the risks you are assuming by participation in classes and workouts at Koda CrossFit Iron View. It is important that you read and understand it completely. After you have done so, please fill out and execute at the bottom.</p>' +
    '<h2>Waiver, Informed Consent, and Covenant Not to Sue</h2>' +
    '<p>I have willingly volunteered to participate in physical conditioning and activities under the direction of Koda CrossFit Iron View, which will include, but may not be limited to, weight, endurance, and/or resistance training. I do here and forever release and discharge and hereby hold harmless Koda CrossFit Iron View and its respective agents, heirs, assigns, contractors, volunteers, sponsors, judges, and employees from any and all claims, demands, damages, rights of action, or causes of action, present or future, arising out of or connected with my participation in activities at Koda CrossFit Iron View, including any injuries resulting therefrom. <span class="caps">THIS WAIVER AND RELEASE OF LIABILITY INCLUDES, WITHOUT LIMITATION, INJURIES WHICH MAY OCCUR AS A RESULT OF (1) EQUIPMENT THAT MAY MALFUNCTION OR BREAK, (2) ANY SLIP, FALL, OR DROPPING OF EQUIPMENT, AND (3) NEGLIGENT INSTRUCTION OR SUPERVISION.</span></p>' +
    '<h2>Assumption of Risk</h2>' +
    '<p>I recognize that exercise might be difficult and strenuous and that there could be dangers inherent in exercise for some individuals. I acknowledge that certain unusual physical changes during exercise may occur. These changes include abnormal blood pressure, fainting, disorders in heartbeat, heart attack, and, in rare instances, death.</p>' +
    '<p>I understand that as a result of my willing participation in activities at Koda CrossFit Iron View, I could suffer an injury or physical disorder that could result in my becoming partially or totally disabled and incapable of performing any gainful employment or having a normal social life.</p>' +
    '<p>As a willing participant in activities at Koda CrossFit Iron View, I represent and warrant that I have been examined by a competent physician who has determined that I am physically capable of participating in such activities.</p>' +
    '<p>I acknowledge and agree that I assume the risks associated with any and all activities and/or exercises in which I participate. I understand and acknowledge that I may terminate my participation in any physical activity at any time for any reason I deem necessary.</p>' +
    '<p class="caps">I ACKNOWLEDGE THAT I HAVE READ THIS WAIVER AND RELEASE AND FULLY UNDERSTAND THAT IT IS A RELEASE OF LIABILITY. BY SIGNING THIS DOCUMENT, I AM WAIVING ANY RIGHT I OR MY SUCCESSORS MIGHT HAVE TO BRING LEGAL ACTION OR ASSERT A CLAIM AGAINST KODA CROSSFIT IRON VIEW AND/OR THE OTHERS REFERRED TO IN THIS DOCUMENT FOR ANY NEGLIGENCE.</p>' +
    '<h2>Photography and Audio/Video Recording</h2>' +
    '<p>I hereby give Koda CrossFit Iron View permission to video tape, photograph, and record my image and/or my likeness during my participation in any activities at Koda CrossFit Iron View. I also understand that giving this permission is in no way an endorsement of Koda CrossFit Iron View or any products distributed by Koda CrossFit Iron View.</p>' +
    '<p class="caps">I HAVE CAREFULLY READ THIS DOCUMENT AND I FULLY UNDERSTAND ITS CONTENTS. I AM AWARE THAT THIS IS A RELEASE OF LIABILITY AND A CONTRACT BETWEEN ME AND KODA CROSSFIT IRON VIEW.</p>' +
    '<table width="100%" cellspacing="0" cellpadding="4" style="margin-top:18px">' +
    '<tr>' +
    '<td width="40%">' + escHtml_(athlete) + '</td>' +
    '<td width="4%"></td>' +
    '<td width="40%">' + sigImg + '</td>' +
    '<td width="4%"></td>' +
    '<td width="12%">' + escHtml_(dateSigned) + '</td>' +
    '</tr><tr>' +
    '<td class="sigline">Athlete&#39;s Name (printed)</td><td></td>' +
    '<td class="sigline">' + (isMinor ? 'Parent/Guardian Signature (athlete under 18)' : 'Signature') + '</td><td></td>' +
    '<td class="sigline">Date</td>' +
    '</tr>' +
    (isMinor
      ? '<tr><td style="padding-top:10px">' + escHtml_(guardian) + '</td><td></td><td></td><td></td><td></td></tr>' +
        '<tr><td class="sigline">Parent/Guardian Name (printed)</td><td></td><td></td><td></td><td></td></tr>'
      : '') +
    '<tr><td style="padding-top:10px">' + escHtml_(email) + '</td><td></td>' +
    '<td style="padding-top:10px">' + escHtml_(referredBy) + '</td><td></td><td></td></tr>' +
    '<tr><td class="sigline">E-mail Address For Follow Up</td><td></td>' +
    '<td class="sigline">Referred By</td><td></td><td></td></tr>' +
    (program
      ? '<tr><td style="padding-top:10px">' + escHtml_(program) + '</td><td></td><td></td><td></td><td></td></tr>' +
        '<tr><td class="sigline">Class Program</td><td></td><td></td><td></td><td></td></tr>'
      : '') +
    (visitLine
      ? '<tr><td style="padding-top:10px" colspan="5">' + escHtml_(visitLine) + '</td></tr>' +
        '<tr><td class="sigline" colspan="5">Visit Type</td></tr>'
      : '') +
    '</table>' +
    '<p class="meta">Executed electronically via the Koda CrossFit Iron View digital waiver page &middot; Recorded ' + recorded + '</p>' +
    '</body></html>';
}
