const fs = require('fs');

// ── Coach Rankings & Constraints ──
const COACHES = {
  "Nate":     { rank: 1,  min: 0,  max: 6,  isMain: false },
  "Greg":     { rank: 2,  min: 12, max: 15, isMain: true },
  "Jessica":  { rank: 3,  min: 3,  max: 7,  isMain: false },
  "Doc Em":   { rank: 4,  min: 0,  max: 8,  isMain: false },
  "Casey":    { rank: 5,  min: 0,  max: 6,  isMain: false },
  "Maggie":   { rank: 6,  min: 0,  max: 6,  isMain: false },
  "Riley":    { rank: 7,  min: 14, max: 18, isMain: true },
  "Jamie":    { rank: 8,  min: 14, max: 18, isMain: true },
  "Dani":     { rank: 9,  min: 8,  max: 12, isMain: true },
  "Isabelle": { rank: 10, min: 8,  max: 12, isMain: true },
  "William":  { rank: 11, min: 2,  max: 6,  isMain: false },
  "Kevin":    { rank: 12, min: 6,  max: 13, isMain: true },
  "Scott":    { rank: 13, min: 0,  max: 4,  isMain: false },
  "Tracey":   { rank: 14, min: 4,  max: 8,  isMain: false },
  "Elissa":   { rank: 15, min: 0,  max: 9,  isMain: false },
  "Kaylie":   { rank: 16, min: 0,  max: 6,  isMain: false },
  "Tyler":    { rank: 17, min: 0,  max: 4,  isMain: false },
  "Roxanne":  { rank: 18, min: 0,  max: 6,  isMain: false },
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_ORDER = [
  "5_00_AM", "5_30_AM", "6_00_AM", "6_30_AM", "7_45_AM",
  "8_45_AM", "9_00_AM", "9_45_AM", "11_00_AM", "12_15_PM",
  "3_30_PM", "4_00_PM", "4_30_PM", "5_00_PM", "5_15_PM", "5_45_PM", "6_00_PM", "6_30_PM"
];

// ── Time conflict table (within 60 min, can't coach both) ──
const CONFLICTS = {
  "5_00_AM": ["5_30_AM"],
  "5_30_AM": ["5_00_AM", "6_00_AM"],
  "6_00_AM": ["5_30_AM", "6_30_AM"],
  "6_30_AM": ["6_00_AM"],
  "7_45_AM": ["8_45_AM"],
  "8_45_AM": ["7_45_AM", "9_00_AM", "9_45_AM"],
  "9_00_AM": ["8_45_AM", "9_45_AM"],
  "9_45_AM": ["9_00_AM", "8_45_AM"],
  "3_30_PM": ["4_00_PM"],
  "4_00_PM": ["3_30_PM", "4_30_PM"],
  "4_30_PM": ["4_00_PM", "5_15_PM"],
  "5_00_PM": ["4_30_PM", "5_15_PM", "5_45_PM"],
  "5_15_PM": ["4_30_PM", "5_00_PM", "5_45_PM", "6_00_PM"],
  "5_45_PM": ["5_00_PM", "5_15_PM", "6_00_PM", "6_30_PM"],
  "6_00_PM": ["5_15_PM", "5_45_PM", "6_30_PM"],
  "6_30_PM": ["5_45_PM", "6_00_PM"],
};

// ── Paired blocks: these slots should go to the same coach ──
// Each group is a set of time keys that should be assigned to one coach on a given day
const PAIRED_BLOCKS = [
  ["5_00_AM", "6_00_AM"],           // 5:00+6:00 same coach
  ["5_30_AM", "6_30_AM", "7_45_AM"], // 5:30+6:30+7:45 same coach (3-class early block)
  ["9_45_AM", "11_00_AM", "12_15_PM"], // late morning block = one coach
];

// Evening A/B alternation: Coach A gets 4:00/5:15/6:30, Coach B gets 4:30/5:45
// 3:30 goes to Coach A if present
// Evening A/B: Coach A gets 4:00/5:15/6:30 (3 classes), Coach B gets 4:30/5:45 (2 classes)
// 3:30 PM pairs with Coach B (since 3:30 conflicts with 4:00)
const EVENING_A_SLOTS = ["4_00_PM", "5_15_PM", "6_30_PM"];
const EVENING_B_SLOTS = ["3_30_PM", "4_30_PM", "5_45_PM"];

// ── Consecutive-day constraints ──
// Greg and Casey are exempt from back-to-back AM and evening→morning restrictions
const CONSECUTIVE_EXEMPT = new Set(["Greg", "Casey"]);

const EARLY_AM_TIMES = new Set(["5_00_AM", "5_30_AM", "6_00_AM", "6_30_AM", "7_45_AM"]);
const EVENING_TIMES = new Set(["3_30_PM", "4_00_PM", "4_30_PM", "5_00_PM", "5_15_PM", "5_45_PM", "6_00_PM", "6_30_PM"]);

const NEXT_DAY = { "Mon": "Tue", "Tue": "Wed", "Wed": "Thu", "Thu": "Fri", "Fri": "Sat" };
const PREV_DAY = { "Tue": "Mon", "Wed": "Tue", "Thu": "Wed", "Fri": "Thu", "Sat": "Fri" };

// ── Helpers ──
function getDay(slot) {
  const m = slot.match(/_(Mon|Tue|Wed|Thu|Fri|Sat)$/);
  return m ? m[1] : null;
}

function getTimeKey(slot) {
  return slot.replace(/_(?:Mon|Tue|Wed|Thu|Fri|Sat)$/, "")
             .replace(/_(?:CrossFit|Hyrox|Kodafit|KodaShred|Specialty|Kratos)/, "");
}

function getFullTimeKey(slot) {
  // Returns time + class type without day, e.g. "5_30_AM_KodaShred"
  return slot.replace(/_(?:Mon|Tue|Wed|Thu|Fri|Sat)$/, "");
}

function slotsConflict(slotA, slotB) {
  if (getDay(slotA) !== getDay(slotB)) return false;
  const timeA = getTimeKey(slotA);
  const timeB = getTimeKey(slotB);
  if (timeA === timeB) return true;
  return (CONFLICTS[timeA] || []).includes(timeB);
}

// ── Consecutive-day penalty helpers ──
function hasEarlyAMOnDay(coach, day) {
  return coachAssignments[coach].some(s => getDay(s) === day && EARLY_AM_TIMES.has(getTimeKey(s)));
}

function hasEveningOnDay(coach, day) {
  return coachAssignments[coach].some(s => getDay(s) === day && EVENING_TIMES.has(getTimeKey(s)));
}

// Returns a penalty score for consecutive-day issues if coach is assigned these slots
function getConsecutivePenalty(coach, slots) {
  if (CONSECUTIVE_EXEMPT.has(coach)) return 0;
  let penalty = 0;

  for (const slot of slots) {
    const day = getDay(slot);
    const timeKey = getTimeKey(slot);

    if (EARLY_AM_TIMES.has(timeKey)) {
      // Back-to-back early AM days
      const prev = PREV_DAY[day];
      const next = NEXT_DAY[day];
      if (prev && hasEarlyAMOnDay(coach, prev)) penalty += 500;
      if (next && hasEarlyAMOnDay(coach, next)) penalty += 500;
      // Evening previous day → early morning
      if (prev && hasEveningOnDay(coach, prev)) penalty += 500;
    }

    if (EVENING_TIMES.has(timeKey)) {
      // Evening → early morning next day
      const next = NEXT_DAY[day];
      if (next && hasEarlyAMOnDay(coach, next)) penalty += 500;
    }
  }

  return penalty;
}

// ── Load availability ──
const data = require('./availability_data.json');
const availability = {};
data.submissions.forEach(sub => {
  availability[sub.coach] = new Set(sub.slots);
});

// All slots that need filling
const allSlots = new Set();
data.submissions.forEach(sub => sub.slots.forEach(s => allSlots.add(s)));
const sortedSlots = [...allSlots].sort((a, b) => {
  const dayA = DAYS.indexOf(getDay(a));
  const dayB = DAYS.indexOf(getDay(b));
  if (dayA !== dayB) return dayA - dayB;
  return SLOT_ORDER.indexOf(getTimeKey(a)) - SLOT_ORDER.indexOf(getTimeKey(b));
});

// ── Schedule state ──
const schedule = {};
const coachAssignments = {};
Object.keys(COACHES).forEach(c => coachAssignments[c] = []);

function canAssign(coach, slot) {
  if (!availability[coach] || !availability[coach].has(slot)) return false;
  for (const existing of coachAssignments[coach]) {
    if (slotsConflict(slot, existing)) return false;
  }
  // Hard limit: max 6 classes per day
  const slotDay = getDay(slot);
  const dayCount = coachAssignments[coach].filter(s => getDay(s) === slotDay).length;
  if (dayCount >= 6) return false;
  // Soft cap: don't exceed max+2 (allows overflow for filling all slots)
  if (coachAssignments[coach].length >= COACHES[coach].max + 2) return false;
  return true;
}

function assign(coach, slot) {
  schedule[slot] = coach;
  coachAssignments[coach].push(slot);
}

function unassign(slot) {
  const coach = schedule[slot];
  if (coach) {
    coachAssignments[coach] = coachAssignments[coach].filter(s => s !== slot);
    delete schedule[slot];
  }
}

// ── Organize slots by day and identify block structures ──

// For each day, group slots into structural blocks
function getDayBlocks(day) {
  const daySlots = sortedSlots.filter(s => getDay(s) === day);

  // Find paired block slots present this day
  const blocks = [];

  // Early block 1: 5:00+6:00 AM
  const early1 = daySlots.filter(s => ["5_00_AM"].includes(getTimeKey(s)));
  const early1b = daySlots.filter(s => ["6_00_AM"].includes(getTimeKey(s)));
  if (early1.length > 0 && early1b.length > 0) {
    blocks.push({ type: "paired", slots: [...early1, ...early1b], label: "5:00+6:00 AM" });
  }

  // Early block 2: 5:30+6:30(+7:45) AM - need to handle multiple class types at 5:30
  const early2_530 = daySlots.filter(s => getTimeKey(s) === "5_30_AM");
  const early2_630 = daySlots.filter(s => getTimeKey(s) === "6_30_AM");
  const early2_745 = daySlots.filter(s => getTimeKey(s) === "7_45_AM");

  // Group 5:30 slots by class type
  const crossfit530 = early2_530.filter(s => getFullTimeKey(s).includes("CrossFit"));
  const other530 = early2_530.filter(s => !getFullTimeKey(s).includes("CrossFit"));

  // The CrossFit 5:30 pairs with 6:30 and 7:45
  if (crossfit530.length > 0 && early2_630.length > 0) {
    blocks.push({ type: "paired", slots: [...crossfit530, ...early2_630, ...early2_745], label: "5:30+6:30+7:45 AM" });
  }

  // Other 5:30 slots (KodaShred, Hyrox) are standalone
  other530.forEach(s => {
    blocks.push({ type: "single", slots: [s], label: getFullTimeKey(s) });
  });

  // Kodafit 8:45
  const kodafit = daySlots.filter(s => getFullTimeKey(s).includes("Kodafit"));
  kodafit.forEach(s => blocks.push({ type: "specialist", slots: [s], label: "Kodafit" }));

  // Hyrox 9:00
  const hyrox9 = daySlots.filter(s => getFullTimeKey(s).includes("9_00_AM_Hyrox"));
  hyrox9.forEach(s => blocks.push({ type: "single", slots: [s], label: "9:00 Hyrox" }));

  // Late morning block: 9:45+11:00+12:15
  const lateMorn = daySlots.filter(s => ["9_45_AM", "11_00_AM", "12_15_PM"].includes(getTimeKey(s)));
  if (lateMorn.length > 0) {
    blocks.push({ type: "paired", slots: lateMorn, label: "9:45-12:15 block" });
  }

  // Evening block (Mon-Thu): A/B alternation
  if (day !== "Fri" && day !== "Sat") {
    const eveningA = daySlots.filter(s => {
      const tk = getTimeKey(s);
      return EVENING_A_SLOTS.includes(tk) && !getFullTimeKey(s).includes("KodaShred");
    });
    const eveningB = daySlots.filter(s => {
      const tk = getTimeKey(s);
      return EVENING_B_SLOTS.includes(tk) && !getFullTimeKey(s).includes("KodaShred");
    });
    const eveningKS = daySlots.filter(s => getFullTimeKey(s).includes("5_15_PM_KodaShred"));

    if (eveningA.length > 0 || eveningB.length > 0) {
      blocks.push({ type: "eveningAB", slotsA: eveningA, slotsB: eveningB, slotsKS: eveningKS, label: "Evening A/B" });
    }
  }

  // Friday evening: single coach block
  if (day === "Fri") {
    const friEvening = daySlots.filter(s => {
      const tk = getTimeKey(s);
      return ["4_00_PM", "5_00_PM", "6_00_PM"].includes(tk);
    });
    if (friEvening.length > 0) {
      blocks.push({ type: "paired", slots: friEvening, label: "Fri evening" });
    }
  }

  // Saturday: Hyrox/Shred cannot be standalone — must pair with adjacent slots.
  // Try to schedule at least 2 consecutive classes per coach.
  if (day === "Sat") {
    // Hyrox mega-block: all Hyrox slots + 7am CF go to one coach (Hyrox specialist)
    // This ensures no standalone Hyrox on Saturday
    const satHyrox = daySlots.filter(s => getFullTimeKey(s).includes("Hyrox"));
    const sat7 = daySlots.filter(s => getTimeKey(s) === "7_00_AM");
    if (satHyrox.length > 0 || sat7.length > 0) {
      blocks.push({ type: "paired", slots: [...satHyrox, ...sat7], label: "Sat Hyrox block" });
    }

    // CrossFit block: 8am CF + 9am CF + 10am CF — pair as one block (or split 2+1 if needed)
    const satCF8 = daySlots.filter(s => getTimeKey(s) === "8_00_AM" && getFullTimeKey(s).includes("CrossFit"));
    const satCF9 = daySlots.filter(s => getTimeKey(s) === "9_00_AM" && getFullTimeKey(s).includes("CrossFit"));
    const satCF10 = daySlots.filter(s => getTimeKey(s) === "10_00_AM");
    const satCFAll = [...satCF8, ...satCF9, ...satCF10];
    if (satCFAll.length > 0) {
      blocks.push({ type: "paired", slots: satCFAll, label: "Sat CF block" });
    }

    // Kratos
    const satKratos = daySlots.filter(s => getTimeKey(s) === "12_00_PM");
    satKratos.forEach(s => blocks.push({ type: "single", slots: [s], label: "Sat Kratos" }));
  }

  return blocks;
}

// ── Find best coach for a block of slots ──
function findBestCoachForBlock(slots, excludeCoaches = []) {
  // Find coaches available for ALL slots in this block
  const candidates = Object.keys(COACHES).filter(c => {
    if (excludeCoaches.includes(c)) return false;
    return slots.every(s => canAssign(c, s));
  });

  if (candidates.length === 0) return null;

  // Score each candidate
  return candidates.map(c => {
    let score = COACHES[c].rank;
    const count = coachAssignments[c].length;
    const info = COACHES[c];

    // Strong bonus if below minimum
    if (count < info.min) score -= 30;

    // Penalty if would exceed max
    if (count + slots.length > info.max) score += 80 + (count + slots.length - info.max) * 30;
    if (count >= info.max) score += 200;

    // Penalty for back-to-back AM days or evening→morning
    score += getConsecutivePenalty(c, slots);

    // Soft penalty: avoid giving a coach only 1 Saturday class
    if (slots.length === 1 && getDay(slots[0]) === 'Sat') {
      const satCount = coachAssignments[c].filter(s => getDay(s) === 'Sat').length;
      if (satCount === 0) score += 80; // prefer coaches already on Sat (2+ classes) over new single-class
    }

    return { coach: c, score };
  }).sort((a, b) => a.score - b.score)[0];
}

// ── Find best coach for a single slot ──
function findBestCoach(slot, excludeCoaches = []) {
  return findBestCoachForBlock([slot], excludeCoaches);
}

// ── PHASE 1: Assign specialist/few-request coaches first ──
// Coaches who requested 5 or fewer slots get their exact requests
const fewRequestCoaches = Object.keys(COACHES)
  .filter(c => availability[c] && availability[c].size > 0 && availability[c].size <= 5)
  .sort((a, b) => COACHES[a].rank - COACHES[b].rank);

for (const coach of fewRequestCoaches) {
  const requested = [...availability[coach]].sort((a, b) => {
    const dayA = DAYS.indexOf(getDay(a));
    const dayB = DAYS.indexOf(getDay(b));
    if (dayA !== dayB) return dayA - dayB;
    return SLOT_ORDER.indexOf(getTimeKey(a)) - SLOT_ORDER.indexOf(getTimeKey(b));
  });

  for (const slot of requested) {
    if (schedule[slot]) continue;
    if (coachAssignments[coach].length >= COACHES[coach].max) break;
    let hasConflict = false;
    for (const existing of coachAssignments[coach]) {
      if (slotsConflict(slot, existing)) { hasConflict = true; break; }
    }
    if (hasConflict) continue;
    assign(coach, slot);
  }
}

// ── PHASE 1.5: Kevin gets Mon & Thu 9:00 AM Hyrox when available ──
for (const day of ["Mon", "Thu"]) {
  const hyroxSlot = `9_00_AM_Hyrox_${day}`;
  if (!schedule[hyroxSlot] && availability["Kevin"] && availability["Kevin"].has(hyroxSlot)) {
    let hasConflict = false;
    for (const existing of coachAssignments["Kevin"]) {
      if (slotsConflict(hyroxSlot, existing)) { hasConflict = true; break; }
    }
    if (!hasConflict) assign("Kevin", hyroxSlot);
  }
}

// ── PHASE 2A: Assign 5:00+6:00 and 5:30+6:30+7:45 AM blocks across all weekdays ──
// Use backtracking to find an assignment that avoids coaches coaching AM on consecutive days
// (except Greg and Casey who are exempt).

function assignAMBlocksGlobally() {
  // Identify the AM paired blocks per day
  const amBlocks = []; // { day, slots, type: "early1"|"early2" }
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
    const daySlots = sortedSlots.filter(s => getDay(s) === day);

    // 5:00+6:00 block
    const block1 = daySlots.filter(s =>
      ["5_00_AM", "6_00_AM"].includes(getTimeKey(s)) &&
      getFullTimeKey(s).includes("CrossFit") && !schedule[s]
    );
    if (block1.length > 0) amBlocks.push({ day, slots: block1, type: "early1" });

    // 5:30+6:30+7:45 block (CrossFit only)
    const block2 = daySlots.filter(s =>
      ["5_30_AM", "6_30_AM", "7_45_AM"].includes(getTimeKey(s)) &&
      getFullTimeKey(s).includes("CrossFit") && !schedule[s]
    );
    if (block2.length > 0) amBlocks.push({ day, slots: block2, type: "early2" });

  }

  // Sort blocks: early1 (5:00+6:00) first, then early2 (5:30+6:30+7:45) — wider blocks
  // have fewer candidates so processing narrow blocks (early1) first gives more flexibility
  amBlocks.sort((a, b) => {
    const typeOrder = { early1: 0, early2: 1 };
    const ta = typeOrder[a.type] || 0;
    const tb = typeOrder[b.type] || 0;
    if (ta !== tb) return ta - tb;
    return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
  });

  // Get candidate coaches for each block
  const blockCandidates = amBlocks.map(block => {
    return Object.keys(COACHES).filter(c =>
      block.slots.every(s => availability[c] && availability[c].has(s))
    );
  });

  // Backtracking solver: assign coaches to blocks avoiding consecutive AM days
  const assignment = new Array(amBlocks.length).fill(null);
  const dayIdx = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4 };

  function isValid(blockIdx, coach) {
    const block = amBlocks[blockIdx];
    const d = dayIdx[block.day];

    // Check no time conflicts with current assignments
    for (const s of block.slots) {
      for (const existing of coachAssignments[coach]) {
        if (slotsConflict(s, existing)) return false;
      }
    }

    // Check coach isn't assigned to another block that conflicts time-wise on same day
    for (let i = 0; i < blockIdx; i++) {
      if (assignment[i] === coach && amBlocks[i].day === block.day) {
        // Same coach same day in different AM block — check conflicts
        for (const s of block.slots) {
          for (const s2 of amBlocks[i].slots) {
            if (slotsConflict(s, s2)) return false;
          }
        }
      }
    }

    // Check consecutive-day constraint (unless exempt)
    if (!CONSECUTIVE_EXEMPT.has(coach)) {
      for (let i = 0; i < blockIdx; i++) {
        if (assignment[i] !== coach) continue;
        const otherD = dayIdx[amBlocks[i].day];
        if (Math.abs(d - otherD) === 1) return false; // Adjacent days
      }
      // Also check against already-assigned slots (from Phase 1)
      const prev = PREV_DAY[block.day];
      const next = NEXT_DAY[block.day];
      if (prev && hasEarlyAMOnDay(coach, prev)) return false;
      if (next && hasEarlyAMOnDay(coach, next)) return false;
    }

    // Don't exceed max + 2
    let totalAssigned = coachAssignments[coach].length;
    for (let i = 0; i < blockIdx; i++) {
      if (assignment[i] === coach) totalAssigned += amBlocks[i].slots.length;
    }
    if (totalAssigned + block.slots.length > COACHES[coach].max + 2) return false;

    return true;
  }

  // Score a complete assignment
  function scoreAssignment() {
    let score = 0;
    const counts = {};
    for (let i = 0; i < amBlocks.length; i++) {
      const c = assignment[i];
      if (!counts[c]) counts[c] = coachAssignments[c].length;
      counts[c] += amBlocks[i].slots.length;
    }
    for (const [c, count] of Object.entries(counts)) {
      if (count < COACHES[c].min) score += (COACHES[c].min - count) * 10;
      if (count > COACHES[c].max) score += (count - COACHES[c].max) * 20;
    }
    return score;
  }

  let bestAssignment = null;
  let bestScore = Infinity;
  let attempts = 0;

  function solve(idx) {
    if (attempts > 100000) return; // Safety limit
    if (idx === amBlocks.length) {
      const s = scoreAssignment();
      if (s < bestScore) {
        bestScore = s;
        bestAssignment = [...assignment];
      }
      return;
    }

    // Sort candidates: prefer coaches furthest below their minimum, then by rank
    const candidateCounts = {};
    for (let i = 0; i < idx; i++) {
      if (assignment[i]) {
        candidateCounts[assignment[i]] = (candidateCounts[assignment[i]] || coachAssignments[assignment[i]].length) + amBlocks[i].slots.length;
      }
    }
    const candidates = blockCandidates[idx]
      .filter(c => isValid(idx, c))
      .sort((a, b) => {
        const countA = candidateCounts[a] || coachAssignments[a].length;
        const countB = candidateCounts[b] || coachAssignments[b].length;
        const deficitA = COACHES[a].min - countA;
        const deficitB = COACHES[b].min - countB;
        if (deficitA !== deficitB) return deficitB - deficitA; // Higher deficit first
        return COACHES[a].rank - COACHES[b].rank;
      });

    for (const c of candidates) {
      assignment[idx] = c;
      attempts++;
      solve(idx + 1);
      assignment[idx] = null;
      if (bestScore === 0) return; // Perfect solution found
    }
  }

  solve(0);

  if (bestAssignment) {
    for (let i = 0; i < amBlocks.length; i++) {
      for (const s of amBlocks[i].slots) {
        assign(bestAssignment[i], s);
      }
    }
    // Solver succeeded
  } else {
    console.log("⚠ AM solver: no valid non-consecutive assignment found, using greedy fallback");
  }
}

assignAMBlocksGlobally();

// ── PHASE 2B: Fill all remaining blocks day by day ──
for (const day of DAYS) {
  const blocks = getDayBlocks(day);

  for (const block of blocks) {
    if (block.type === "paired" || block.type === "single") {
      // Find unassigned slots in this block
      const unassigned = block.slots.filter(s => !schedule[s]);
      if (unassigned.length === 0) continue;

      // Try to assign all unassigned to one coach
      const best = findBestCoachForBlock(unassigned);
      if (best) {
        for (const s of unassigned) assign(best.coach, s);
      } else {
        // Can't find one coach for all — assign individually
        for (const s of unassigned) {
          if (schedule[s]) continue;
          const b = findBestCoach(s);
          if (b) assign(b.coach, s);
        }
      }
    }

    else if (block.type === "specialist") {
      for (const s of block.slots) {
        if (schedule[s]) continue;
        const b = findBestCoach(s);
        if (b) assign(b.coach, s);
      }
    }

    else if (block.type === "eveningAB") {
      const unassignedA = block.slotsA.filter(s => !schedule[s]);
      const unassignedB = block.slotsB.filter(s => !schedule[s]);
      const unassignedKS = block.slotsKS.filter(s => !schedule[s]);

      // Find Coach A (for 3:30/4:00/5:15/6:30)
      let coachA = null;
      if (unassignedA.length > 0) {
        const bestA = findBestCoachForBlock(unassignedA);
        if (bestA) {
          coachA = bestA.coach;
          for (const s of unassignedA) assign(coachA, s);
        }
      }

      // Find Coach B (for 4:30/5:45), must be different from Coach A
      if (unassignedB.length > 0) {
        const exclude = coachA ? [coachA] : [];
        const bestB = findBestCoachForBlock(unassignedB, exclude);
        if (bestB) {
          for (const s of unassignedB) assign(bestB.coach, s);
        } else {
          // Fallback: assign individually
          for (const s of unassignedB) {
            if (schedule[s]) continue;
            const b = findBestCoach(s, exclude);
            if (b) assign(b.coach, s);
          }
        }
      }

      // KodaShred 5:15 — can be a third coach
      for (const s of unassignedKS) {
        if (schedule[s]) continue;
        const b = findBestCoach(s);
        if (b) assign(b.coach, s);
      }
    }
  }
}

// ── PHASE 3: Ensure all main coaches hit minimums ──
for (let round = 0; round < 20; round++) {
  const needyCoaches = Object.entries(COACHES)
    .filter(([c, info]) => coachAssignments[c].length < info.min && availability[c])
    .sort((a, b) => {
      const needA = a[1].min - coachAssignments[a[0]].length;
      const needB = b[1].min - coachAssignments[b[0]].length;
      if (needA !== needB) return needB - needA;
      return a[1].rank - b[1].rank;
    });

  if (needyCoaches.length === 0) break;

  for (const [coach, info] of needyCoaches) {
    if (coachAssignments[coach].length >= info.min) continue;

    // Try to swap: take slots from coaches who are over their minimum
    for (const slot of sortedSlots) {
      if (coachAssignments[coach].length >= info.min) break;
      const current = schedule[slot];
      if (!current || current === coach) continue;
      if (!canAssign(coach, slot)) continue;

      // Don't steal from few-request coaches
      if (availability[current] && availability[current].size <= 5) continue;

      // Only swap if current coach can afford it
      const currentCount = coachAssignments[current].length;
      if (currentCount <= COACHES[current].min) continue;

      // Skip if swap would create a consecutive-day issue (unless exempt)
      if (getConsecutivePenalty(coach, [slot]) > 0) continue;

      // Check: would swapping break a paired block?
      const timeKey = getTimeKey(slot);
      const day = getDay(slot);
      let breaksBlock = false;

      for (const blockDef of PAIRED_BLOCKS) {
        if (blockDef.includes(timeKey)) {
          // Check if other slots in this block on this day are assigned to the same coach
          const otherBlockSlots = sortedSlots.filter(s =>
            getDay(s) === day && s !== slot &&
            blockDef.includes(getTimeKey(s)) && schedule[s] === current
          );
          if (otherBlockSlots.length > 0) {
            // Would break the block — only swap if we can take the whole block
            const wholeBlock = [slot, ...otherBlockSlots];
            const canTakeAll = wholeBlock.every(s => s === slot || canAssign(coach, s));
            if (canTakeAll && coachAssignments[coach].length + wholeBlock.length <= COACHES[coach].max + 2) {
              // Swap the whole block
              for (const bs of wholeBlock) {
                unassign(bs);
                assign(coach, bs);
              }
              breaksBlock = true; // handled
            } else {
              breaksBlock = true; // can't take whole block, skip
            }
            break;
          }
        }
      }

      if (!breaksBlock) {
        unassign(slot);
        assign(coach, slot);
      }
    }
  }
}

// ── PHASE 4: Fill any remaining unfilled slots ──
for (const slot of sortedSlots) {
  if (schedule[slot]) continue;

  const candidates = Object.keys(COACHES)
    .filter(c => canAssign(c, slot))
    .map(c => {
      let score = COACHES[c].rank;
      if (coachAssignments[c].length >= COACHES[c].max) score += 100;
      if (coachAssignments[c].length < COACHES[c].min) score -= 30;
      score += getConsecutivePenalty(c, [slot]);
      return { coach: c, score };
    })
    .sort((a, b) => a.score - b.score);

  if (candidates.length > 0) {
    assign(candidates[0].coach, slot);
  }
}

// ── PHASE 5: Post-optimization — fix broken blocks ──
// Check each paired block and try to consolidate to one coach
for (const day of DAYS) {
  for (const blockDef of PAIRED_BLOCKS) {
    const blockSlots = sortedSlots.filter(s =>
      getDay(s) === day && blockDef.includes(getTimeKey(s))
    );

    if (blockSlots.length < 2) continue;

    // Check if they're all the same coach already
    const coaches = [...new Set(blockSlots.map(s => schedule[s]).filter(Boolean))];
    if (coaches.length <= 1) continue;

    // Try to consolidate to the coach who has the most slots in this block
    const coachCounts = {};
    blockSlots.forEach(s => {
      const c = schedule[s];
      if (c) coachCounts[c] = (coachCounts[c] || 0) + 1;
    });

    const sortedCoaches = Object.entries(coachCounts).sort((a, b) => b[1] - a[1]);
    const targetCoach = sortedCoaches[0][0];

    // Can the target coach take all slots?
    const canConsolidate = blockSlots.every(s =>
      schedule[s] === targetCoach || canAssign(targetCoach, s)
    );

    if (canConsolidate) {
      // Check the coaches losing slots can afford it
      let canSwap = true;
      for (const s of blockSlots) {
        const c = schedule[s];
        if (c && c !== targetCoach) {
          if (coachAssignments[c].length <= COACHES[c].min) {
            canSwap = false;
            break;
          }
        }
      }

      // Don't consolidate if it would create a consecutive-day issue
      const newSlots = blockSlots.filter(s => schedule[s] !== targetCoach);
      if (getConsecutivePenalty(targetCoach, newSlots) > 0) canSwap = false;

      if (canSwap) {
        for (const s of blockSlots) {
          if (schedule[s] !== targetCoach) {
            unassign(s);
            assign(targetCoach, s);
          }
        }
      }
    }
  }
}

// ── Output ──
fs.writeFileSync('./schedule_output.json', JSON.stringify({ schedule, coachAssignments, coaches: COACHES }, null, 2));

console.log("Schedule generated!\n");
const unfilled = sortedSlots.filter(s => !schedule[s]);
console.log(`Total slots: ${sortedSlots.length}, Filled: ${sortedSlots.length - unfilled.length}, Unfilled: ${unfilled.length}`);
if (unfilled.length > 0) console.log("UNFILLED:", unfilled.join(", "));

console.log("\nCoach totals:");
Object.entries(COACHES)
  .sort((a, b) => a[1].rank - b[1].rank)
  .forEach(([name, info]) => {
    const count = coachAssignments[name].length;
    if (count > 0 || info.min > 0) {
      const flag = count < info.min ? " ⚠ BELOW MIN" : count > info.max ? " (over max)" : "";
      console.log(`  ${name.padEnd(12)} ${count} (${info.min}-${info.max})${flag}`);
    }
  });

// Verify no conflicts
let conflicts = 0;
for (const [coach, slots] of Object.entries(coachAssignments)) {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsConflict(slots[i], slots[j])) {
        console.log(`⚠ CONFLICT: ${coach} has ${slots[i]} and ${slots[j]}`);
        conflicts++;
      }
    }
  }
}
if (conflicts === 0) console.log("\n✓ No scheduling conflicts.");

// Show block integrity
console.log("\nBlock integrity check:");
for (const day of DAYS) {
  for (const blockDef of PAIRED_BLOCKS) {
    const blockSlots = sortedSlots.filter(s => getDay(s) === day && blockDef.includes(getTimeKey(s)));
    if (blockSlots.length < 2) continue;
    const coaches = [...new Set(blockSlots.map(s => schedule[s]).filter(Boolean))];
    if (coaches.length > 1) {
      console.log(`  ⚠ ${day} ${blockDef.join("+")} split: ${blockSlots.map(s => getTimeKey(s) + "=" + schedule[s]).join(", ")}`);
    }
  }
}

// Check consecutive-day issues
console.log("\nConsecutive-day check:");
let consecIssues = 0;
for (const [coach, slots] of Object.entries(coachAssignments)) {
  if (CONSECUTIVE_EXEMPT.has(coach)) continue;
  const amDays = new Set();
  const eveDays = new Set();
  for (const s of slots) {
    if (EARLY_AM_TIMES.has(getTimeKey(s))) amDays.add(getDay(s));
    if (EVENING_TIMES.has(getTimeKey(s))) eveDays.add(getDay(s));
  }
  for (const d of amDays) {
    const prev = PREV_DAY[d];
    if (prev && amDays.has(prev)) {
      console.log(`  ⚠ ${coach}: back-to-back AM on ${prev}+${d}`);
      consecIssues++;
    }
    if (prev && eveDays.has(prev)) {
      console.log(`  ⚠ ${coach}: evening ${prev} → AM ${d}`);
      consecIssues++;
    }
  }
}
if (consecIssues === 0) console.log("  ✓ No back-to-back AM or evening→morning issues.");

// Check Saturday standalone slots
console.log("\nSaturday check:");
const satCoachSlots = {};
for (const s of sortedSlots) {
  if (getDay(s) !== "Sat") continue;
  const c = schedule[s];
  if (c) {
    if (!satCoachSlots[c]) satCoachSlots[c] = [];
    satCoachSlots[c].push(s);
  }
}
let satIssues = 0;
for (const [coach, slots] of Object.entries(satCoachSlots)) {
  if (slots.length === 1) {
    const ft = getFullTimeKey(slots[0]);
    if (ft.includes("Hyrox") || ft.includes("KodaShred")) {
      console.log(`  ⚠ ${coach}: standalone ${ft} on Saturday`);
      satIssues++;
    } else {
      console.log(`  ⚠ ${coach}: only 1 Saturday class (${ft})`);
      satIssues++;
    }
  }
}
if (satIssues === 0) console.log("  ✓ All Saturday coaches have 2+ classes, no standalone Hyrox/Shred.");

// Show evening A/B pattern
console.log("\nEvening patterns:");
for (const day of ["Mon", "Tue", "Wed", "Thu"]) {
  const aSlots = sortedSlots.filter(s => getDay(s) === day && EVENING_A_SLOTS.includes(getTimeKey(s)) && !getFullTimeKey(s).includes("KodaShred"));
  const bSlots = sortedSlots.filter(s => getDay(s) === day && EVENING_B_SLOTS.includes(getTimeKey(s)) && !getFullTimeKey(s).includes("KodaShred"));
  const aCoaches = [...new Set(aSlots.map(s => schedule[s]).filter(Boolean))];
  const bCoaches = [...new Set(bSlots.map(s => schedule[s]).filter(Boolean))];
  const isAB = aCoaches.length === 1 && bCoaches.length === 1 && aCoaches[0] !== bCoaches[0];
  console.log(`  ${day}: A=[${aCoaches.join(",")}] B=[${bCoaches.join(",")}] ${isAB ? "✓ A/B" : "mixed"}`);
}
