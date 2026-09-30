import { supabase, isOwner } from "./supabase.js";
import { escapeHtml, drillCard, planItem, adminDrill } from "./templates.js";

// State and persistence
const STATS_KEY = "millerHoopsStats";
let drills = [],
  playerStats = JSON.parse(localStorage.getItem(STATS_KEY) || "null") || {
    done: 0,
    mins: 0,
    fav: [],
    days: [],
    activity: [],
  },
  filter = "All",
  timer;
const getElement = (x) => document.getElementById(x);
function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(playerStats));
}

// Drill library and favorites
async function loadDrills() {
  const { data, error } = await supabase
    .from("drills")
    .select("*")
    .order("created_at");
  if (error) {
    console.error(error);
    drills = [];
    getElement("grid").innerHTML =
      '<div class="muted">Could not load drills right now.</div>';
    return;
  }
  drills = data || [];
  render();
  plan();
}
function render() {
  let q = (getElement("search")?.value || "").toLowerCase(),
    cats = ["All", ...new Set(drills.map((d) => d.category))];
  getElement("filters").innerHTML = cats
    .map(
      (c) =>
        `<button class="${filter == c ? "active" : ""}" data-action="filter" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`,
    )
    .join("");
  let L = drills.filter(
    (d) =>
      (filter == "All" ||
        (filter == "Favorites"
          ? playerStats.fav.includes(d.id)
          : d.category == filter)) &&
      (!q ||
        d.name.toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q)),
  );
  getElement("grid").innerHTML = L.length
    ? L.map((d) => drillCard(d, playerStats.fav)).join("")
    : '<div class="muted">No drills found.</div>';
  stats();
}
function sortIt() {
  drills.sort((a, b) => a.name.localeCompare(b.name));
  render();
}
function fav(id) {
  playerStats.fav = playerStats.fav.includes(id)
    ? playerStats.fav.filter((x) => x != id)
    : [...playerStats.fav, id];
  saveStats();
  render();
}

// Timer and completion tracking
function start(id) {
  let d = drills.find((x) => x.id == id),
    end = Date.now() + d.minutes * 60000;
  clearInterval(timer);
  timer = setInterval(() => {
    let z = Math.max(0, end - Date.now()),
      e = getElement("t" + id);
    if (!e) return;
    if (!z) {
      e.textContent = "Done! 🔥";
      clearInterval(timer);
      complete(d);
      return;
    }
    e.textContent = `Time left: ${Math.floor(z / 60000)}:${String(Math.floor(z / 1000) % 60).padStart(2, "0")}`;
  }, 250);
}
function complete(d) {
  playerStats.done++;
  playerStats.mins += d.minutes;
  let today = new Date().toISOString().slice(0, 10);
  if (!playerStats.days.includes(today)) playerStats.days.push(today);
  playerStats.activity.unshift({ n: d.name, m: d.minutes });
  playerStats.activity = playerStats.activity.slice(0, 8);
  saveStats();
  stats();
}

// Progress and challenge rendering
function stats() {
  getElement("done").textContent = playerStats.done;
  getElement("minsTotal").textContent = playerStats.mins;
  getElement("favTotal").textContent = playerStats.fav.length;
  let n = 0,
    dt = new Date();
  while (playerStats.days.includes(dt.toISOString().slice(0, 10))) {
    n++;
    dt.setDate(dt.getDate() - 1);
  }
  getElement("streak").textContent = n;
  getElement("activity").innerHTML =
    playerStats.activity
      .map(
        (a) =>
          `<div class="item">🏀 <b>${escapeHtml(a.n)}</b> — ${a.m} min</div>`,
      )
      .join("") ||
    '<p class="muted">Complete a timed drill to see activity.</p>';
  let x = Math.min(5, playerStats.done);
  getElement("cb").style.width = x * 20 + "%";
  getElement("ct").textContent = x + "/5 drills completed";
}

// Navigation
function tab(x) {
  ["training", "daily", "progress", "profile", "owner"].forEach((y) =>
    getElement(y).classList.toggle("hidden", y != x),
  );
  if (x == "daily") plan();
  if (x == "profile") loadProfile();
  if (x == "owner") checkOwner();
}

// Daily workout
function makePlan() {
  let ids = [...drills]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(5, drills.length))
    .map((d) => d.id);
  localStorage.setItem("mhPlan", JSON.stringify(ids));
  plan();
}
function plan() {
  let ids = JSON.parse(localStorage.getItem("mhPlan") || "[]"),
    L = ids.map((id) => drills.find((d) => d.id == id)).filter(Boolean);
  getElement("plan").innerHTML = L.length
    ? L.map((d, i) => planItem(d, i)).join("")
    : '<p class="muted">No plan yet.</p>';
}

// Player profile
function saveProfile() {
  let p = {
    name: getElement("pname").value.trim() || "Hooper",
    pos: getElement("position").value,
    skill: getElement("skill").value,
  };
  localStorage.setItem("mhProfile", JSON.stringify(p));
  getElement("welcome").textContent =
    `Profile saved: ${p.name} • ${p.pos} • Focus: ${p.skill}`;
}
function loadProfile() {
  let p = JSON.parse(localStorage.getItem("mhProfile") || "null");
  if (p) {
    getElement("pname").value = p.name;
    getElement("position").value = p.pos;
    getElement("skill").value = p.skill;
    getElement("welcome").textContent =
      `Welcome back, ${p.name}! Focus: ${p.skill}`;
  }
}

// Owner authentication and drill management
async function checkOwner() {
  const owner = await isOwner();
  getElement("loginPanel").classList.toggle("hidden", owner);
  getElement("adminPanel").classList.toggle("hidden", !owner);
  if (owner) renderAdmin();
}
async function login() {
  const email = getElement("email").value.trim(),
    password = getElement("password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  getElement("loginMsg").textContent = error ? error.message : "Logged in!";
  if (!error) {
    getElement("password").value = "";
    checkOwner();
  }
}
async function logout() {
  await supabase.auth.signOut();
  checkOwner();
}
function renderAdmin() {
  if (
    !getElement("adminPanel") ||
    getElement("adminPanel").classList.contains("hidden")
  )
    return;
  getElement("adminList").innerHTML =
    drills.map((d) => adminDrill(d)).join("") ||
    '<p class="muted">No drills yet.</p>';
}
async function addDrill() {
  if (!(await isOwner())) return;
  const payload = {
    name: getElement("newName").value.trim(),
    category: getElement("newCat").value,
    description: getElement("newDesc").value.trim(),
    minutes: Number(getElement("newMins").value),
    video_url: getElement("newVideo").value.trim() || null,
  };
  if (!payload.name || !payload.description || !payload.minutes)
    return alert("Please fill in the drill name, description, and minutes.");
  const { error } = await supabase.from("drills").insert(payload);
  if (error) return alert(error.message);
  getElement("newName").value = "";
  getElement("newDesc").value = "";
  getElement("newVideo").value = "";
  await loadDrills();
  renderAdmin();
}
async function updateDrill(id) {
  if (!(await isOwner())) return;
  const payload = {
    name: getElement("n" + id).value.trim(),
    category: getElement("c" + id).value,
    description: getElement("d" + id).value.trim(),
    minutes: Number(getElement("m" + id).value),
    video_url: getElement("v" + id).value.trim() || null,
  };
  const { error } = await supabase.from("drills").update(payload).eq("id", id);
  if (error) return alert(error.message);
  await loadDrills();
  renderAdmin();
}
async function deleteDrill(id) {
  if (!(await isOwner())) return;
  if (!confirm("Delete this drill?")) return;
  const { error } = await supabase.from("drills").delete().eq("id", id);
  if (error) return alert(error.message);
  playerStats.fav = playerStats.fav.filter((x) => x != id);
  saveStats();
  await loadDrills();
  renderAdmin();
}

// Event wiring and startup. Delegation also covers freshly rendered drill buttons.
const actions = {
  tab: (button) => tab(button.dataset.section),
  filter: (button) => {
    filter = button.dataset.category;
    render();
  },
  sortIt,
  fav: (button) => fav(button.dataset.id),
  start: (button) => start(button.dataset.id),
  makePlan,
  clearPlan: () => {
    localStorage.removeItem("mhPlan");
    plan();
  },
  saveProfile,
  login,
  logout,
  addDrill,
  updateDrill: (button) => updateDrill(button.dataset.id),
  deleteDrill: (button) => deleteDrill(button.dataset.id),
};
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) actions[button.dataset.action]?.(button);
});
getElement("search").addEventListener("input", render);
// Run session reads outside Supabase's auth callback to avoid reentrant auth calls.
supabase.auth.onAuthStateChange(() => setTimeout(checkOwner, 0));
stats();
loadDrills();
