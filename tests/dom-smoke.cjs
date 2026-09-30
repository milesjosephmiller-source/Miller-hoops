// Run with jsdom installed: NODE_PATH=/path/to/node_modules node tests/dom-smoke.cjs
const { JSDOM } = require("jsdom");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = resolve(__dirname, "..");
const mock = `
window.backend = { owner: false, calls: [], fail: false, drills: [
  {id:'a', name:'Zigzag', category:'Ball Handling', description:'Handle the ball', minutes:1, video_url:null},
  {id:'b', name:'Around the World', category:"Coach's Choice", description:'Shoot & score', minutes:2, video_url:'https://example.com/demo'}
] };
export async function isOwner() { return window.backend.owner; }
export const supabase = {
  auth: {
    onAuthStateChange(callback) { window.authChanged = callback; },
    async signInWithPassword(credentials) { window.backend.calls.push(['login',credentials.email]); window.backend.owner=true; return {}; },
    async signOut() { window.backend.owner=false; return {}; }
  },
  from(table) {
    if(table !== 'drills') throw new Error('Unexpected table');
    return {
      select(columns) { return { async order(column) {
        window.backend.calls.push(['select',columns,column]);
        return window.backend.fail ? {error:{message:'offline'}} : {data:window.backend.drills};
      }}; },
      async insert(payload) { window.backend.calls.push(['insert',payload]); window.backend.drills.push({...payload,id:'c'}); return {}; },
      update(payload) {return {async eq(key,id) { window.backend.calls.push(['update',key,id,payload]); Object.assign(window.backend.drills.find(d=>d.id===id),payload); return {}; }};},
      delete() {return {async eq(key,id) { window.backend.calls.push(['delete',key,id]); window.backend.drills=window.backend.drills.filter(d=>d.id!==id); return {}; }};}
    };
  }
};`;

(async () => {
  const dom = new JSDOM(readFileSync(resolve(root, "index.html"), "utf8"), {
    url: "http://localhost",
    runScripts: "outside-only",
  });
  const window = dom.window,
    document = window.document;
  const click = (selector) => {
    const button = document.querySelector(selector);
    assert.ok(button, selector);
    button.click();
  };
  const fill = (selector, value) => {
    const el = document.querySelector(selector);
    el.value = value;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const flush = async () => {
    for (let i = 0; i < 5; i++)
      await new Promise((resolve) => setImmediate(resolve));
  };
  const count = (selector) => document.querySelectorAll(selector).length;
  const visible = (selector) =>
    !document.querySelector(selector).classList.contains("hidden");
  window.localStorage.setItem(
    "mhProfile",
    JSON.stringify({ name: "Miles", pos: "Guard", skill: "Defense" }),
  );
  window.localStorage.setItem(
    "millerHoopsStats",
    JSON.stringify({ done: 4, mins: 20, fav: ["b"], days: [], activity: [] }),
  );
  let tick,
    now = window.Date.now();
  window.Date.now = () => now;
  window.setInterval = (callback) => {
    tick = callback;
    return 1;
  };
  window.clearInterval = () => {
    tick = null;
  };
  window.confirm = () => true;
  window.alert = (message) => {
    throw new Error(message);
  };
  const templates = readFileSync(
    resolve(root, "js/templates.js"),
    "utf8",
  ).replace(/export /g, "");
  const app = readFileSync(resolve(root, "js/app.js"), "utf8").replace(
    /^import .*;\n/gm,
    "",
  );
  try {
    vm.runInContext(
      templates + "\n" + mock.replace(/export /g, "") + "\n" + app,
      dom.getInternalVMContext(),
    );
    await flush();
    assert.equal(count(".card"), 2);
    click('[data-action="sortIt"]');
    assert.equal(
      document.querySelector(".card h3").textContent,
      "Around the World",
    );
    fill("#search", "zig");
    assert.equal(count(".card"), 1);
    fill("#search", "");
    click('[data-category="Favorites"]');
    assert.equal(count(".card"), 1);
    click('[data-action="fav"]');
    assert.equal(count(".card"), 0);
    click('[data-category="All"]');
    const custom = Array.from(
      document.querySelectorAll("#filters button"),
    ).find((b) => b.dataset.category === "Coach's Choice");
    custom.click();
    assert.equal(count(".card"), 1);
    click('[data-category="All"]');
    click('[data-section="profile"]');
    assert.equal(document.querySelector("#pname").value, "Miles");
    fill("#pname", "Miles Miller");
    click('[data-action="saveProfile"]');
    assert.equal(
      JSON.parse(window.localStorage.mhProfile).name,
      "Miles Miller",
    );
    click('[data-section="daily"]');
    click('[data-action="makePlan"]');
    assert.equal(count("#plan .item"), 2);
    click('#plan [data-id="a"]');
    now += 61000;
    tick();
    assert.equal(document.querySelector("#done").textContent, "5");
    assert.equal(document.querySelector("#minsTotal").textContent, "21");
    assert.equal(
      document.querySelector("#ct").textContent,
      "5/5 drills completed",
    );
    assert.equal(document.querySelector("#streak").textContent, "1");
    assert.ok(
      document.querySelector("#activity").textContent.includes("Zigzag"),
    );
    click('[data-action="clearPlan"]');
    assert.equal(count("#plan .item"), 0);
    click('[data-section="owner"]');
    await flush();
    assert.equal(visible("#adminPanel"), false);
    click('[data-action="addDrill"]');
    await flush();
    assert.equal(
      window.backend.calls.some((c) => c[0] === "insert"),
      false,
    );
    fill("#email", "owner@example.com");
    fill("#password", "test");
    click('[data-action="login"]');
    await flush();
    assert.equal(visible("#adminPanel"), true);
    assert.equal(document.querySelector("#password").value, "");
    fill("#newName", "Layups");
    fill("#newDesc", "Finish at the rim");
    click('[data-action="addDrill"]');
    await flush();
    assert.ok(document.querySelector("#nc"));
    fill("#nc", "Reverse Layups");
    click('[data-action="updateDrill"][data-id="c"]');
    await flush();
    assert.equal(
      window.backend.drills.find((d) => d.id === "c").name,
      "Reverse Layups",
    );
    click('[data-action="deleteDrill"][data-id="c"]');
    await flush();
    assert.equal(count("#nc"), 0);
    click('[data-action="logout"]');
    await flush();
    assert.equal(visible("#adminPanel"), false);
    window.backend.fail = true;
    await vm.runInContext("loadDrills()", dom.getInternalVMContext());
    assert.ok(
      document
        .querySelector("#grid")
        .textContent.includes("Could not load drills"),
    );
    console.log(
      "Passed: loading/error, search, sort, category escaping, favorites, profile, daily plan, timer, progress, challenge, owner guard/login/CRUD/logout.",
    );
  } finally {
    window.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
