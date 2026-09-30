export const escapeHtml = (x) =>
  String(x ?? "").replace(
    /[&<>\"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '\"': "&quot;",
        "'": "&#39;",
      })[c],
  );

export function drillCard(d, favorites) {
  return `<article class="card">
    <button class="fav" data-action="fav" data-id="${escapeHtml(d.id)}">${favorites.includes(d.id) ? "⭐" : "☆"}</button>
    <span class="tag">${escapeHtml(d.category)}</span>
    <h3>${escapeHtml(d.name)}</h3>
    <p>${escapeHtml(d.description)}</p>
    <b>${d.minutes} min</b>${
      d.video_url
        ? `<div style="margin-top:10px">
    <a href="${escapeHtml(d.video_url)}" target="_blank" rel="noopener">▶️ Watch Me Demonstrate</a>
    </div>`
        : ""
    }<div class="actions">
    <button class="start" data-action="start" data-id="${escapeHtml(d.id)}">▶ Start</button>
    </div>
    <div id="t${d.id}" class="timer">
    </div>
    </article>`;
}

export function planItem(d, i) {
  return `<div class="item">
    <b>${i + 1}. ${escapeHtml(d.name)}</b> — ${d.minutes} min <button class="primary" data-action="start" data-id="${escapeHtml(d.id)}">Start</button>
    </div>`;
}

export function adminDrill(d) {
  return `<div class="item">
    <div class="formgrid">
    <input id="n${d.id}" value="${escapeHtml(d.name)}">
    <select id="c${d.id}">
    <option ${d.category === "Shooting" ? "selected" : ""}>Shooting</option>
    <option ${d.category === "Ball Handling" ? "selected" : ""}>Ball Handling</option>
    <option ${d.category === "Finishing" ? "selected" : ""}>Finishing</option>
    <option ${d.category === "Defense" ? "selected" : ""}>Defense</option>
    </select>
    <input id="m${d.id}" type="number" min="1" max="180" value="${d.minutes}">
    <input id="v${d.id}" value="${escapeHtml(d.video_url || "")}" placeholder="Demo video URL">
    </div>
    <input id="d${d.id}" class="search field-block" value="${escapeHtml(d.description)}">
    <button class="primary" data-action="updateDrill" data-id="${escapeHtml(d.id)}">💾 Save</button> <button data-action="deleteDrill" data-id="${escapeHtml(d.id)}">🗑️ Delete</button>
    </div>`;
}
