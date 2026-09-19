const KEY = "kindling.v1";
const CRISIS = /\b(suicid\w*|kill myself|killing myself|end my life|end it all|take my life|want to die|wanna die|self-?harm|hurt myself|hurting myself|cut myself)\b/i;

const WIRING = [
  ["adhd", "ADHD"],
  ["audhd", "AuDHD (both)"],
  ["autism", "Autism"],
  ["unsure", "Unsure — exploring"]
];
const FOUND = [
  ["child", "As a child"],
  ["teen", "As a teen"],
  ["adult", "As an adult"],
  ["recent", "Recently — still landing"],
  ["never", "Never formally, but it fits"]
];
const VOICE = [
  ["steady", "Steady"],
  ["warm", "Warm"],
  ["brief", "Brief"],
  ["wry", "Wry"]
];
const ENERGY = [
  ["empty", "Empty"],
  ["low", "Low"],
  ["mixed", "Mixed"],
  ["enough", "Enough"],
  ["sparking", "Sparking"]
];
const SENSORY = [
  ["little", "Too little"],
  ["okay", "Okay"],
  ["building", "Building"],
  ["much", "Too much"]
];
const SOCIAL = [
  ["hidden", "Hidden"],
  ["one", "One person"],
  ["maybe", "Maybe"],
  ["drained", "Drained"]
];
const TRAUMA = [
  ["quiet", "Quiet"],
  ["hum", "Humming"],
  ["loud", "Loud"],
  ["flood", "Flooding"]
];
const SKILLS = [
  ["time", "Time blindness", "Time is a feeling, not a clock. Externalise it: timers, body cues, one visible clock."],
  ["demand", "Demand avoidance", "A request can feel like a wall. Make it an invitation, not an order. You choose."],
  ["rsd", "RSD sting", "The sting is real. It is not proof you are too much. Delay the reply. Breathe out longer than in."],
  ["transition", "Transitions", "Leaving one context costs extra. Take a three-minute buffer. Name what you're leaving and entering."],
  ["mask", "Masking cost", "The performance drains the next morning. Put the face down here. Nothing needs performing."],
  ["interest", "Interest-based attention", "Using what lights you up is strategy, not avoidance. Ride the wave, then one tiny move."],
  ["energy", "Energy accounting", "Spend before you're empty. One micro-step on a low day, a fuller plan on a flow day."],
  ["late", "The late-diagnosis arc", "Grief for the years you thought you were broken. Anger at systems that missed you. Relief mixed with now what. Re-reading your life through a new lens is the work."]
];

const state = load();
let view = "home";
let sessionStep = 0;
let sessionData = {};
let deferredInstall = null;
let pendingCapacity = Object.assign({ energy: "", sensory: "", social: "", trauma: "" }, (state.capacity || {}));

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ("id_" + Date.now());
}
function blank() {
  return {
    version: 1,
    profile: { name: "", wiring: "adhd", found: "adult", voice: "steady", onboardedAt: "" },
    capacity: { energy: "", sensory: "", social: "", trauma: "", at: "" },
    sessions: [],
    notes: [],
    patterns: [],
    skillsTried: [],
    dim: false
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return Object.assign(blank(), JSON.parse(raw));
  } catch (e) {
    return blank();
  }
}
function save() {
  try {
    if (state.sessions.length > 60) state.sessions = state.sessions.slice(-60);
    if (state.notes.length > 80) state.notes = state.notes.slice(-80);
    if (state.patterns.length > 40) state.patterns = state.patterns.slice(-40);
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {}
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function firstName() {
  return (state.profile.name || "").trim().split(/\s+/)[0];
}
function dayPart() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function go(name) {
  view = name;
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("on", el.id === name));
  document.querySelectorAll("nav.dock button").forEach((btn) => btn.classList.toggle("on", btn.dataset.go === name));
  if (name === "home") renderHome();
  if (name === "session") renderSession();
  if (name === "skills") renderSkills();
  if (name === "notes") renderNotes();
  if (name === "restart") renderRestart();
  if (name === "patterns") renderPatterns();
  window.scrollTo(0, 0);
}

function homeLine() {
  const map = {
    adhd: "ADHD wiring is real. We work with it, not against it.",
    audhd: "Two systems, one nervous system. Both needs can be true.",
    autism: "The world wasn't built for this brain. We can still make it fit.",
    unsure: "Exploring is allowed. No label required to start."
  };
  return map[state.profile.wiring] || "You don't have to perform today.";
}

function capacitySentence() {
  const c = state.capacity || {};
  if (c.trauma === "flood") return "The load is high. We lower the demand to zero and start with the body.";
  if (c.energy === "empty" && c.social === "drained") return "Empty and drained. One micro-step, or just sit. Both count.";
  if (c.sensory === "much") return "Senses are full. Thinking can wait. Lower the volume first.";
  if (c.energy === "sparking") return "Spark is up. Use it for one small experiment, then rest.";
  if (c.trauma === "loud") return "The hum is loud. We go gently. One thing at a time.";
  if (c.energy || c.sensory || c.social || c.trauma) return "Noted. Capacity shapes what we offer today.";
  return "How's the weather in the nervous system?";
}

function suggest() {
  const c = state.capacity || {};
  if (c.trauma === "flood" || c.sensory === "much") return { go: "restart", title: "Reduce first", copy: "Lower input, downshift the body, then one next inch." };
  if (c.energy === "empty") return { go: "restart", title: "Micro-step only", copy: "One physical action. The rest can wait." };
  if (c.energy === "sparking") return { go: "session", title: "Use the spark", copy: "What matters, what's in the way, one experiment." };
  return { go: "session", title: "Session", copy: "What matters today, and what's in the way?" };
}

function renderChoices(id, items, current, onPick, extraClass) {
  const root = document.getElementById(id);
  if (!root) return;
  root.innerHTML = "";
  items.forEach((item) => {
    const val = item[0], label = item[1], extra = item[2] || extraClass || "";
    const b = document.createElement("button");
    b.type = "button";
    b.className = (id.indexOf("c-") === 0 ? "chip " : "choice ") + extra + (current === val ? " on" : "");
    b.textContent = label;
    b.onclick = () => onPick(val);
    root.appendChild(b);
  });
}

function renderOnboard() {
  document.getElementById("name").value = state.profile.name || "";
  renderChoices("q-wiring", WIRING, state.profile.wiring, (v) => { state.profile.wiring = v; renderOnboard(); });
  renderChoices("q-found", FOUND, state.profile.found, (v) => { state.profile.found = v; renderOnboard(); });
  renderChoices("q-voice", VOICE, state.profile.voice, (v) => { state.profile.voice = v; renderOnboard(); });
}

function renderHome() {
  const n = firstName();
  document.getElementById("daypart").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("greeting").textContent = n ? dayPart() + ", " + n + "." : dayPart() + ".";
  document.getElementById("home-line").textContent = homeLine();
  pendingCapacity = Object.assign({ energy: "", sensory: "", social: "", trauma: "" }, state.capacity || {});
  const setC = (key) => (v) => {
    pendingCapacity[key] = v;
    state.capacity = Object.assign({}, pendingCapacity, { at: new Date().toISOString() });
    save();
    renderHome();
  };
  renderChoices("c-energy", ENERGY, pendingCapacity.energy, setC("energy"));
  renderChoices("c-sensory", SENSORY, pendingCapacity.sensory, setC("sensory"));
  renderChoices("c-social", SOCIAL, pendingCapacity.social, setC("social"));
  renderChoices("c-trauma", TRAUMA, pendingCapacity.trauma, setC("trauma"));
  document.getElementById("coach-line").textContent = capacitySentence();
  const s = suggest();
  document.getElementById("suggest-title").textContent = s.title;
  document.getElementById("suggest-copy").textContent = s.copy;
  document.getElementById("suggest-btn").onclick = () => go(s.go);
}

const SESSION_STEPS = [
  { kicker: "What matters", prompt: "What is true for you today? One sentence is enough.", field: "matters" },
  { kicker: "What's in the way", prompt: "What is blocking the start? Too big, too boring, too scary, too many steps, or a demand spike?", field: "block" },
  { kicker: "One experiment", prompt: "One small, reversible experiment. What will you try?", field: "experiment" }
];

function renderSession() {
  if (!sessionData.matters && !sessionData.block && !sessionData.experiment) {
    sessionStep = 0;
    sessionData = {};
  }
  const step = SESSION_STEPS[sessionStep];
  document.getElementById("session-step").textContent = "Step " + (sessionStep + 1) + " of 3";
  const body = document.getElementById("session-body");
  body.innerHTML = "<p class='kicker spark'>" + step.kicker + "</p><p class='coach'>" + step.prompt + "</p><textarea class='field' id='session-input' placeholder='Type here…' maxlength='600'>" + escapeHtml(sessionData[step.field] || "") + "</textarea>";
  const input = document.getElementById("session-input");
  input.oninput = () => { sessionData[step.field] = input.value; };
  document.getElementById("session-back").style.visibility = sessionStep === 0 ? "hidden" : "visible";
  document.getElementById("session-next").textContent = sessionStep === 2 ? "Save & finish" : "Next";
}

function sessionNext() {
  const step = SESSION_STEPS[sessionStep];
  const input = document.getElementById("session-input");
  if (input) sessionData[step.field] = input.value.trim();
  if (sessionStep < 2) {
    sessionStep += 1;
    renderSession();
    return;
  }
  // finish
  const note = {
    id: uid(),
    at: new Date().toISOString(),
    matters: sessionData.matters || "",
    block: sessionData.block || "",
    experiment: sessionData.experiment || "",
    capacity: Object.assign({}, state.capacity || {})
  };
  state.sessions.push(note);
  state.notes.push(note);
  // pattern detection (simple)
  if (sessionData.block && /too many steps|too big/.test(sessionData.block.toLowerCase())) {
    addPattern("Tasks feel too big or have too many steps");
  }
  if (sessionData.block && /demand/.test(sessionData.block.toLowerCase())) {
    addPattern("Demand spikes block the start");
  }
  if (state.capacity && state.capacity.trauma === "flood") {
    addPattern("Trauma load runs high on some days");
  }
  save();
  sessionData = {};
  sessionStep = 0;
  go("notes");
}

function addPattern(text) {
  const existing = state.patterns.find((p) => p.text === text);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.last = new Date().toISOString();
  } else {
    state.patterns.push({ id: uid(), text, count: 1, first: new Date().toISOString(), last: new Date().toISOString() });
  }
}

function renderSkills() {
  const root = document.getElementById("skill-list");
  root.innerHTML = "";
  SKILLS.forEach(([id, title, copy]) => {
    const art = document.createElement("article");
    art.className = "card";
    art.innerHTML = "<p class='kicker spark'>" + title + "</p><p class='coach'>" + escapeHtml(copy) + "</p><button class='btn' style='margin-top:.65rem'>Try this</button>";
    art.querySelector("button").onclick = () => {
      state.skillsTried.push({ id, at: new Date().toISOString() });
      save();
      art.querySelector("button").textContent = "Noted";
    };
    root.appendChild(art);
  });
}

function renderNotes() {
  const root = document.getElementById("note-list");
  root.innerHTML = "";
  const empty = document.getElementById("notes-empty");
  if (!state.notes.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  state.notes.slice().reverse().forEach((n) => {
    const d = new Date(n.at);
    const art = document.createElement("article");
    art.className = "note";
    art.innerHTML = "<p class='kicker'>" + d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + "</p>" +
      "<p class='coach'><strong>Matters:</strong> " + escapeHtml(n.matters || "—") + "</p>" +
      "<p class='coach'><strong>In the way:</strong> " + escapeHtml(n.block || "—") + "</p>" +
      "<p class='coach'><strong>Experiment:</strong> " + escapeHtml(n.experiment || "—") + "</p>";
    root.appendChild(art);
  });
}

function renderRestart() {
  document.getElementById("restart-note").textContent = "";
}
function restartReduce() {
  document.getElementById("restart-note").textContent = "Lights low. Notifications off. One room. No new input for ten minutes.";
}
function restartBody() {
  document.getElementById("restart-note").textContent = "Feet on floor. Long exhale. Water. No decisions yet.";
}
function restartInch() {
  document.getElementById("restart-note").textContent = "One physical action only: stand, drink, or put the object in your hand. That is the whole plan.";
}

function renderPatterns() {
  const root = document.getElementById("pattern-list");
  root.innerHTML = "";
  if (!state.patterns.length) return;
  state.patterns.slice().reverse().forEach((p) => {
    const art = document.createElement("article");
    art.className = "card";
    art.innerHTML = "<p class='kicker spark'>Seen " + (p.count || 1) + " time" + ((p.count || 1) > 1 ? "s" : "") + "</p><p class='coach'>" + escapeHtml(p.text) + "</p>";
    root.appendChild(art);
  });
}

// events
document.getElementById("start-btn").onclick = () => {
  state.profile.name = document.getElementById("name").value.trim();
  state.profile.onboardedAt = new Date().toISOString();
  save();
  go("home");
};
document.getElementById("too-much-btn").onclick = () => {
  state.dim = !state.dim;
  document.body.classList.toggle("dim", state.dim);
  document.getElementById("too-much-btn").textContent = state.dim ? "Lights up" : "Too much";
};
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
document.getElementById("session-next").onclick = sessionNext;
document.getElementById("session-back").onclick = () => { if (sessionStep > 0) { sessionStep -= 1; renderSession(); } };
document.getElementById("restart-reduce").onclick = restartReduce;
document.getElementById("restart-body").onclick = restartBody;
document.getElementById("restart-inch").onclick = restartInch;

document.getElementById("install-btn").onclick = async () => {
  if (deferredInstall) {
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    document.getElementById("install-note").textContent = outcome === "accepted" ? "Added." : "Not added.";
    deferredInstall = null;
  } else {
    document.getElementById("install-note").textContent = "Use your browser's Add to Home Screen option.";
  }
};
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });

document.getElementById("export-btn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kindling-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById("reset-btn").onclick = () => {
  if (confirm("Start over? This wipes local data.")) {
    localStorage.removeItem(KEY);
    location.reload();
  }
};

// init
if (!state.profile.onboardedAt) {
  go("onboard");
  renderOnboard();
} else {
  go("home");
}

// service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
