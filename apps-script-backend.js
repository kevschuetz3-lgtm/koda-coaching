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
  "Maggie": "maggiekerrigan@gmail.com",
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
  "Roxanne": "mrs.roxannelear@gmail.com"
};

// ── SETUP — Run this once ──
function setup() {
  // Create or find the spreadsheet
  var ss = getOrCreateSpreadsheet();
  Logger.log("Spreadsheet URL: " + ss.getUrl());
  Logger.log("Spreadsheet ID: " + ss.getId());

  // Store the spreadsheet ID for later use
  PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());

  // Set up weekly email reminder trigger (every Thursday at 10am)
  deleteExistingTriggers();
  ScriptApp.newTrigger("sendReminderEmails")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(10)
    .create();

  Logger.log("Setup complete! Weekly reminder trigger set for Thursdays at 10am.");
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

// ── POST: Route by action ──
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    if (action === 'deleteAvailabilityTabs') {
      return deleteAvailabilityTabs(data);
    }

    // Default: form submission
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

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Delete availability tabs for a given week ──
function deleteAvailabilityTabs(data) {
  var weekOf = data.weekOf; // e.g. "2026-04-13"
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sheets = ss.getSheets();
  var deleted = [];

  // Keep protected tabs
  var keepTabs = new Set(["Submissions"]);

  for (var i = sheets.length - 1; i >= 0; i--) {
    var name = sheets[i].getName();
    if (keepTabs.has(name)) continue;
    // Delete tabs containing the old weekOf date
    if (name.indexOf(weekOf) !== -1) {
      ss.deleteSheet(sheets[i]);
      deleted.push(name);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Deleted " + deleted.length + " tabs for " + weekOf,
    deleted: deleted
  })).setMimeType(ContentService.MimeType.JSON);
}

// ── GET: Fetch last week's submission for a coach ──
function doGet(e) {
  var action = e.parameter.action;

  if (action === "getLastWeek") {
    var coach = e.parameter.coach;
    return getLastWeekData(coach);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "API running" }))
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
  var formUrl = "YOUR_GITHUB_PAGES_URL";  // Update this after deploying to GitHub Pages

  Object.keys(COACHES).forEach(function(name) {
    var email = COACHES[name];
    if (email && !submitted[name]) {
      MailApp.sendEmail({
        to: email,
        subject: "Koda CrossFit — Submit Your Availability for Next Week",
        htmlBody:
          "<p>Hey " + name + ",</p>" +
          "<p>Friendly reminder to submit your coaching availability for the week of " +
          Utilities.formatDate(nextMon, Session.getScriptTimeZone(), "MMM d, yyyy") + ".</p>" +
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
