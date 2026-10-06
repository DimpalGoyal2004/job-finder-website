

/* ---------- 1. Config ---------- */
const API_URL = "https://remotive.com/api/remote-jobs";
const BACKEND_URL = ""; // Baad me apna Node/Express server lagao, jaise "http://localhost:5000"
const SAVED_KEY = "hireway_saved";
const EMAILS_KEY = "hireway_emails";

const CATEGORY_SEARCH = {
  "Software development": "developer",
  "Design": "design",
  "Data and analytics": "data",
  "Marketing": "marketing",
  "Content and writing": "writer",
  "Engineering": "engineer",
};

const FALLBACK_JOBS = [
  { id: "f1", title: "Frontend Developer Intern", company: "Flux Labs", location: "Remote", type: "internship", typeLabel: "Internship", salary: "₹15,000 / month", tags: ["HTML", "CSS", "JavaScript"], url: "#", posted: "" },
  { id: "f2", title: "Junior Data Analyst", company: "DataNest", location: "Noida", type: "job", typeLabel: "Full-time", salary: "₹4 - 6 LPA", tags: ["Excel", "SQL", "Python"], url: "#", posted: "" },
  { id: "f3", title: "UI/UX Design Intern", company: "Pixel Co", location: "Delhi", type: "internship", typeLabel: "Internship", salary: "₹12,000 / month", tags: ["Figma", "Prototyping"], url: "#", posted: "" },
  { id: "f4", title: "Content Writer", company: "Craftly Media", location: "Remote", type: "job", typeLabel: "Full-time", salary: "₹3 - 4 LPA", tags: ["SEO", "Copywriting"], url: "#", posted: "" },
  { id: "f5", title: "React Developer", company: "Nova Soft", location: "Worldwide", type: "job", typeLabel: "Full-time", salary: "₹6 - 9 LPA", tags: ["React", "Node.js"], url: "#", posted: "" },
  { id: "f6", title: "Marketing Intern", company: "CloudBay", location: "Remote", type: "internship", typeLabel: "Internship", salary: "₹8,000 / month", tags: ["Social media", "Analytics"], url: "#", posted: "" },
];

/* ---------- 2. State and helpers ---------- */
const state = {
  jobs: [],
  filter: "all",
  keyword: "",
  usingFallback: false,
  saved: new Set(loadJSON(SAVED_KEY, [])),
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("localStorage not available:", err);
  }
}

// API ka data HTML me daalne se pehle escape karna zaroori hai (XSS se bachne ke liye)
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : "#";
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const diff = Date.now() - new Date(dateString).getTime();
  if (Number.isNaN(diff)) return "";
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function formatJobType(type) {
  if (!type) return "Full-time";
  return type
    .split("_")
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join("-");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 3. Toast notifications ---------- */
function toast(message, kind = "info") {
  let box = $("#toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.setAttribute("aria-live", "polite");
    document.body.append(box);
  }
  const item = document.createElement("div");
  item.className = `toast ${kind}`;
  item.textContent = message;
  box.append(item);
  requestAnimationFrame(() => item.classList.add("show"));
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 350);
  }, 3200);
}

/* ---------- 4. API layer ---------- */
function normalizeJob(raw) {
  const jobType = (raw.job_type || "").toLowerCase();
  const isIntern = jobType === "internship" || /\bintern(ship)?\b/i.test(raw.title || "");
  return {
    id: String(raw.id),
    title: raw.title || "Untitled role",
    company: raw.company_name || "Unknown company",
    location: raw.candidate_required_location || "Remote",
    type: isIntern ? "internship" : "job",
    typeLabel: isIntern ? "Internship" : formatJobType(jobType),
    salary: raw.salary || "",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    url: raw.url,
    posted: raw.publication_date,
  };
}

async function fetchFromApi(params = {}) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([key, value]) => value && url.searchParams.set(key, value));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return (data.jobs || []).map(normalizeJob);
  } finally {
    clearTimeout(timer);
  }
}

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((job) => (seen.has(job.id) ? false : seen.add(job.id)));
}

async function loadJobs({ keyword = "", location = "" } = {}) {
  state.keyword = keyword;
  showSkeletons();

  let jobs = [];
  try {
    if (keyword) {
      jobs = await fetchFromApi({ search: keyword, limit: 30 });
    } else {
      // Pehli load: normal jobs + internships dono mangwao
      const [general, interns] = await Promise.all([
        fetchFromApi({ limit: 20 }),
        fetchFromApi({ search: "intern", limit: 8 }).catch(() => []),
      ]);
      jobs = dedupe([...general, ...interns]);
    }
    state.usingFallback = false;
  } catch (err) {
    console.error("Jobs API failed:", err);
    const word = keyword.toLowerCase();
    jobs = FALLBACK_JOBS.filter(
      (job) => !word || `${job.title} ${job.company} ${job.tags.join(" ")}`.toLowerCase().includes(word)
    );
    state.usingFallback = true;
    toast("Live jobs load nahi hui, sample data dikha rahe hain.", "error");
  }

  // Location filter (API ke location field me search karte hain)
  const place = location.trim().toLowerCase();
  if (place && place !== "remote") {
    jobs = jobs.filter((job) => {
      const loc = job.location.toLowerCase();
      return loc.includes(place) || loc.includes("worldwide") || loc.includes("anywhere");
    });
  }

  state.jobs = jobs;
  renderJobs();
}

/* ---------- 5. Rendering ---------- */
function showSkeletons() {
  const grid = $("#jobGrid");
  grid.innerHTML = Array.from({ length: 6 }, () => `
    <article class="job-card skeleton" aria-hidden="true">
      <div class="sk sk-logo"></div>
      <div class="sk sk-line w70"></div>
      <div class="sk sk-line w40"></div>
      <div class="sk sk-line"></div>
      <div class="sk sk-btn"></div>
    </article>`).join("");
}

function jobCardHTML(job) {
  const saved = state.saved.has(job.id);
  const meta = [job.location, job.typeLabel, job.salary || timeAgo(job.posted)]
    .filter(Boolean)
    .map((item) => `<li>${escapeHTML(item)}</li>`)
    .join("");
  const skills = job.tags
    .slice(0, 3)
    .map((tag) => `<span>${escapeHTML(tag)}</span>`)
    .join("");

  return `
    <article class="job-card tilt" data-type="${job.type}">
      <div class="job-top">
        <div class="company-logo">${escapeHTML(job.company.charAt(0).toUpperCase())}</div>
        <button class="save-btn ${saved ? "saved" : ""}" data-id="${escapeHTML(job.id)}"
                aria-label="${saved ? "Remove saved job" : "Save job"}" aria-pressed="${saved}">
          ${saved ? "&#9829;" : "&#9825;"}
        </button>
      </div>
      <h3>${escapeHTML(job.title)}</h3>
      <p class="company">${escapeHTML(job.company)}</p>
      <ul class="meta">${meta}</ul>
      <div class="skills">${skills}</div>
      <a href="${escapeHTML(safeUrl(job.url))}" class="btn btn-outline" target="_blank" rel="noopener noreferrer">Apply now</a>
    </article>`;
}

function ensureResultInfo() {
  let info = $("#resultInfo");
  if (!info) {
    info = document.createElement("p");
    info.id = "resultInfo";
    info.className = "result-info";
    $("#jobGrid").before(info);
  }
  return info;
}

function renderJobs() {
  const grid = $("#jobGrid");
  const list = state.jobs.filter((job) => state.filter === "all" || job.type === state.filter);
  const info = ensureResultInfo();

  const label = state.filter === "all" ? "openings" : state.filter === "job" ? "jobs" : "internships";
  const forWord = state.keyword ? ` for "${state.keyword}"` : "";
  const source = state.usingFallback ? " (sample data)" : "";
  info.textContent = `Showing ${list.length} ${label}${forWord}${source}`;

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No results found</h3>
        <p>Try a different keyword, or switch the tab above. Live data me sirf remote roles aate hain.</p>
      </div>`;
    return;
  }
  grid.innerHTML = list.map(jobCardHTML).join("");
}

/* ---------- 6. Filter tabs ---------- */
function setFilter(filter) {
  state.filter = filter;
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.filter === filter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });
  renderJobs();
}

function initTabs() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => setFilter(tab.dataset.filter)));
}

/* ---------- 7. Job grid: save button ---------- */
function initGrid() {
  $("#jobGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".save-btn");
    if (!button) return;

    const id = button.dataset.id;
    const nowSaved = !state.saved.has(id);
    nowSaved ? state.saved.add(id) : state.saved.delete(id);
    saveJSON(SAVED_KEY, [...state.saved]);

    button.classList.toggle("saved", nowSaved);
    button.setAttribute("aria-pressed", nowSaved);
    button.innerHTML = nowSaved ? "&#9829;" : "&#9825;";
    toast(nowSaved ? "Job saved" : "Removed from saved", nowSaved ? "success" : "info");

    // auth.js is event ko sunta hai aur saved jobs user ke account me save karta hai
    document.dispatchEvent(new CustomEvent("job:toggle", { detail: { id, saved: nowSaved } }));
  });
}

/* ---------- 8. Search, chips, categories ---------- */
function runSearch() {
  const keyword = $("#keyword").value.trim();
  const location = $("#location").value.trim();
  const type = $("#type").value;

  state.filter = type === "job" || type === "internship" ? type : "all";
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.filter === state.filter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });

  loadJobs({ keyword, location });
  $("#jobs").scrollIntoView({ behavior: "smooth" });
}

function initSearch() {
  $("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  // Popular chips
  $$(".popular .chip").forEach((chip) => {
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      $("#keyword").value = chip.textContent.trim();
      $("#searchForm").requestSubmit();
    });
  });
}

function initCategories() {
  $$(".category-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();
      const name = $("h3", card).textContent.trim();
      $("#keyword").value = CATEGORY_SEARCH[name] || name;
      $("#location").value = "";
      $("#type").value = "all";
      runSearch();
    });
  });
}

/* ---------- 9. Navbar mobile menu ---------- */
function initMenu() {
  const navbar = $(".navbar");
  const toggle = $("#menuToggle");

  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    const open = navbar.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
    toggle.innerHTML = open ? "&#10005;" : "&#9776;";
  });

  $$(".nav-links a").forEach((link) =>
    link.addEventListener("click", () => {
      navbar.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = "&#9776;";
    })
  );
}

/* ---------- 10. 3D effects ---------- */
function initTilt() {
  if (prefersReducedMotion) return;
  const MAX = 8; // max degrees

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const card = event.target.closest?.(".tilt");
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    card.style.setProperty("--ry", ((px - 0.5) * MAX * 2).toFixed(2));
    card.style.setProperty("--rx", ((0.5 - py) * MAX * 2).toFixed(2));
  });

  document.addEventListener("pointerout", (event) => {
    const card = event.target.closest?.(".tilt");
    if (card && !card.contains(event.relatedTarget)) {
      card.style.setProperty("--rx", 0);
      card.style.setProperty("--ry", 0);
    }
  });
}

function initHeroParallax() {
  if (prefersReducedMotion) return;
  const hero = $(".hero");
  const scene = $(".scene-inner");
  if (!hero || !scene) return;

  hero.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    scene.style.setProperty("--sx", (x * 24).toFixed(2));
    scene.style.setProperty("--sy", (-y * 24).toFixed(2));
  });

  hero.addEventListener("pointerleave", () => {
    scene.style.setProperty("--sx", 0);
    scene.style.setProperty("--sy", 0);
  });
}

/* ---------- 11. Count-up stats ---------- */
function animateCount(element) {
  const target = Number(element.dataset.count);
  if (prefersReducedMotion) {
    element.textContent = target.toLocaleString("en-IN");
    return;
  }
  const duration = 1600;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    element.textContent = Math.round(target * eased).toLocaleString("en-IN");
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function initCounters() {
  const counters = $$("[data-count]");
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  counters.forEach((counter) => observer.observe(counter));
}

/* ---------- 12. Newsletter ---------- */
async function subscribeEmail(email) {
  // Agar backend set hai to server pe bhejo, nahi to localStorage me rakho
  if (BACKEND_URL) {
    const response = await fetch(`${BACKEND_URL}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error("Server error");
    return;
  }
  const emails = loadJSON(EMAILS_KEY, []);
  if (!emails.includes(email)) emails.push(email);
  saveJSON(EMAILS_KEY, emails);
}

function initNewsletter() {
  const form = $("#newsletterForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#email");
    const email = input.value.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

    if (!valid) {
      toast("Please enter a valid email address.", "error");
      input.focus();
      return;
    }

    const button = $("button", form);
    button.disabled = true;
    try {
      await subscribeEmail(email);
      toast("You're in! We'll send new openings to your inbox.", "success");
      form.reset();
    } catch (err) {
      console.error(err);
      toast("Something went wrong. Please try again.", "error");
    } finally {
      button.disabled = false;
    }
  });
}

/* ---------- 13. Init ---------- */
// Login / signup buttons ab auth.js handle karta hai
document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initTilt();
  initHeroParallax();
  initCounters();
  initSearch();
  initCategories();
  initTabs();
  initGrid();
  initNewsletter();
  loadJobs();
});