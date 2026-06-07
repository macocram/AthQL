const REPO = "Amit3200/AthQL";
const REPO_URL = `https://github.com/${REPO}`;

function formatCount(value) {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function setStat(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

async function loadRepoStats() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}`);
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const data = await response.json();

    setStat("stat-stars", formatCount(data.stargazers_count));
    setStat("stat-forks", formatCount(data.forks_count));
    setStat("stat-issues", formatCount(data.open_issues_count));
    setStat("nav-star-count", formatCount(data.stargazers_count));
    setStat("stat-updated", formatDate(data.pushed_at));

    const langNode = document.getElementById("stat-language");
    if (langNode && data.language) langNode.textContent = data.language;
  } catch {
    setStat("stat-stars", "—");
    setStat("stat-forks", "—");
    setStat("stat-issues", "—");
    setStat("nav-star-count", "—");
    setStat("stat-updated", "—");
  }
}

async function loadLatestRelease() {
  const releaseNode = document.getElementById("stat-release");
  const linkNode = document.getElementById("stat-release-link");
  const fallback = releaseNode?.getAttribute("data-fallback") ?? "—";

  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const data = await response.json();
    const label = (data.tag_name ?? fallback).replace(/^v/i, "");
    setStat("stat-release", label);
    if (linkNode && data.html_url) linkNode.href = data.html_url;
  } catch {
    setStat("stat-release", fallback);
  }
}

function setupNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  toggle?.addEventListener("click", () => {
    links?.classList.toggle("open");
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#") return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      links?.classList.remove("open");
    });
  });
}

function setupCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const selector = button.getAttribute("data-copy");
      const block = selector ? document.querySelector(selector) : null;
      if (!block) return;
      const text = block.textContent?.trim() ?? "";
      try {
        await navigator.clipboard.writeText(text);
        const label = button.textContent;
        button.textContent = "Copied!";
        window.setTimeout(() => {
          button.textContent = label;
        }, 1400);
      } catch {
        button.textContent = "Copy failed";
      }
    });
  });
}

const MOCK_QUERIES = {
  orders: {
    db: "analytics",
    stats: "Scanned 12.4 MB · 2.1s · $0.00006",
    code: `<span class="sql-c">-- saved under Daily · tags: analytics, orders</span>
<span class="sql-k">SELECT</span>
  o.order_date,
  o.region,
  <span class="sql-k">COUNT</span>(<span class="sql-k">DISTINCT</span> o.customer_id) <span class="sql-k">AS</span> customers,
  <span class="sql-k">SUM</span>(o.amount) <span class="sql-k">AS</span> revenue
<span class="sql-k">FROM</span> analytics.orders o
<span class="sql-k">WHERE</span> o.order_date <span class="sql-k">BETWEEN</span> <span class="sql-d">DATE</span> <span class="sql-s">'2026-01-01'</span> <span class="sql-k">AND</span> <span class="sql-d">CURRENT_DATE</span>
<span class="sql-k">GROUP BY</span> 1, 2
<span class="sql-k">ORDER BY</span> revenue <span class="sql-k">DESC</span>`
  },
  cohorts: {
    db: "analytics",
    stats: "Scanned 84.1 MB · 3.4s · $0.00042",
    code: `<span class="sql-c">-- saved under Cohorts · tags: users, retention</span>
<span class="sql-k">SELECT</span> 
  date_trunc(<span class="sql-s">'month'</span>, u.created_at) <span class="sql-k">AS</span> cohort_month,
  <span class="sql-k">COUNT</span>(<span class="sql-k">DISTINCT</span> u.id) <span class="sql-k">AS</span> new_users,
  <span class="sql-k">COUNT</span>(<span class="sql-k">DISTINCT</span> o.customer_id) <span class="sql-k">AS</span> active_shoppers
<span class="sql-k">FROM</span> production.users u
<span class="sql-k">LEFT JOIN</span> analytics.orders o <span class="sql-k">ON</span> u.id = o.customer_id
  <span class="sql-k">AND</span> o.order_date &gt;= u.created_at
<span class="sql-k">GROUP BY</span> 1
<span class="sql-k">ORDER BY</span> 1 <span class="sql-k">DESC</span>`
  },
  adhoc: {
    db: "production",
    stats: "Scanned 1.1 KB · 0.8s · $0.00000",
    code: `<span class="sql-c">-- scratchpad · tags: temp, debug</span>
<span class="sql-k">SELECT</span> 
  table_schema, 
  table_name, 
  row_count
<span class="sql-k">FROM</span> information_schema.tables
<span class="sql-k">WHERE</span> table_schema = <span class="sql-s">'production'</span>
<span class="sql-k">ORDER BY</span> row_count <span class="sql-k">DESC</span>
<span class="sql-k">LIMIT</span> 10;`
  }
};

function setupSqlMockup() {
  const tabs = document.querySelectorAll(".hero-sql-tab");
  const dbNode = document.getElementById("sql-mock-db");
  const codeNode = document.getElementById("sql-mock-code");
  const statsNode = document.getElementById("sql-mock-stats");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const key = tab.getAttribute("data-tab");
      const query = MOCK_QUERIES[key];
      if (query) {
        if (dbNode) dbNode.textContent = query.db;
        if (statsNode) statsNode.textContent = query.stats;
        if (codeNode) codeNode.innerHTML = query.code;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadRepoStats();
  loadLatestRelease();
  setupNav();
  setupCopyButtons();
  setupSqlMockup();

  document.querySelectorAll("[data-repo-link]").forEach((node) => {
    node.setAttribute("href", REPO_URL);
  });
});
