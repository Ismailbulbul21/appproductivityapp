const DAY_MAP: Record<string, number> = {
  isniin: 1,
  talaado: 2,
  arbaco: 3,
  khamiis: 4,
  jimco: 5,
  sabti: 6,
  axad: 0,
};

interface ParsedTask {
  title: string;
  due_date: string | null;
  due_time: string | null;
}

function getNextWeekday(dayIndex: number): Date {
  const now = new Date();
  const diff = (dayIndex - now.getDay() + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next;
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(hours: number, minutes = 0): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseSomaliInput(text: string): ParsedTask {
  let remaining = text.toLowerCase().trim();
  let due_date: string | null = null;
  let due_time: string | null = null;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // "saacad kadib" / "laba saacadood kadib"
  const hoursFromNow = remaining.match(
    /(\d+|laba|saddex)\s*saacad(?:ood)?\s*kadib/
  );
  if (hoursFromNow) {
    let hrs = parseInt(hoursFromNow[1]);
    if (hoursFromNow[1] === "laba") hrs = 2;
    if (hoursFromNow[1] === "saddex") hrs = 3;
    const future = new Date(Date.now() + hrs * 3600000);
    due_date = formatDateLocal(future);
    due_time = formatTime(future.getHours(), future.getMinutes());
    remaining = remaining.replace(hoursFromNow[0], "").trim();
  }

  // "berri galab" / "berri 8 fiidnimo" / "berri 10 subaxnimo"
  if (!due_date && remaining.includes("berri")) {
    due_date = formatDateLocal(tomorrow);
    remaining = remaining.replace("berri", "").trim();

    if (remaining.includes("galab")) {
      due_time = "14:00";
      remaining = remaining.replace("galab", "").trim();
    }
    if (remaining.includes("subaxnimo")) {
      const m = remaining.match(/(\d+)\s*subaxnimo/);
      if (m) {
        due_time = formatTime(parseInt(m[1]));
        remaining = remaining.replace(m[0], "").trim();
      }
    }
    if (remaining.includes("fiidnimo")) {
      const m = remaining.match(/(\d+)\s*fiidnimo/);
      if (m) {
        due_time = formatTime(parseInt(m[1]) + 12);
        remaining = remaining.replace(m[0], "").trim();
      }
    }
  }

  // "maanta" / today
  if (!due_date && remaining.includes("maanta")) {
    due_date = formatDateLocal(today);
    remaining = remaining.replace("maanta", "").trim();
  }

  // Day names
  if (!due_date) {
    for (const [dayName, dayIdx] of Object.entries(DAY_MAP)) {
      if (remaining.includes(dayName)) {
        due_date = formatDateLocal(getNextWeekday(dayIdx));
        remaining = remaining.replace(dayName, "").trim();
        break;
      }
    }
  }

  // Standalone time: "10 subaxnimo" / "8 fiidnimo"
  if (!due_time) {
    const subax = remaining.match(/(\d+)\s*subaxnimo/);
    if (subax) {
      due_time = formatTime(parseInt(subax[1]));
      remaining = remaining.replace(subax[0], "").trim();
      if (!due_date) due_date = formatDateLocal(today);
    }
    const fiid = remaining.match(/(\d+)\s*fiidnimo/);
    if (fiid) {
      due_time = formatTime(parseInt(fiid[1]) + 12);
      remaining = remaining.replace(fiid[0], "").trim();
      if (!due_date) due_date = formatDateLocal(today);
    }
  }

  const title = remaining.replace(/\s+/g, " ").trim();

  return { title: title || text, due_date, due_time };
}
