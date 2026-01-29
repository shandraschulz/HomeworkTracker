/*
COPILOT CONSTRAINTS — READ BEFORE MAKING CHANGES

- This is a working application with stable core logic.
- Do NOT rewrite, refactor, or reorganize existing functions unless explicitly instructed.
- Do NOT change storage keys, data schema, or persisted state behavior.
- Make MINIMAL, localized diffs only.
- Prefer extending existing patterns over creating new abstractions.
- Do NOT introduce new libraries or frameworks.
- Do NOT restyle globally unless the change is explicitly requested.
- Bootstrap default behaviors (especially blue active/expanded states) must be overridden, not relied upon.
- UI changes should preserve the existing soft, subdued design language.
- If unsure, ASK or mirror an existing implementation instead of inventing one.

GOAL: incremental, controlled changes without breaking existing behavior.
*/

// ============== API Configuration ==============
const API_BASE_URL = window.API_BASE_URL || '/api';

// Helper for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// ============== Original Constants ==============
const STORAGE_KEY = "hw_tracker_semester_v2";

const SEMESTER_START = new Date("2026-01-12T00:00:00");
const SEMESTER_END   = new Date("2026-05-15T00:00:00");

const els = {
  classTabs: document.getElementById("classTabs"),
  classNameInput: document.getElementById("classNameInput"),
  addClassBtn: document.getElementById("addClassBtn"),

  activeClassTitle: document.getElementById("activeClassTitle"),
  activeClassSubtitle: document.getElementById("activeClassSubtitle"),

  taskTitleInput: document.getElementById("taskTitleInput"),
  taskDueInput: document.getElementById("taskDueInput"),
  addTaskBtn: document.getElementById("addTaskBtn"),

  clearCompletedBtn: document.getElementById("clearCompletedBtn"),

  viewWeekBtn: document.getElementById("viewWeekBtn"),
  viewListBtn: document.getElementById("viewListBtn"),
  viewTodayBtn: document.getElementById("viewTodayBtn"),
  viewThisWeekBtn: document.getElementById("viewThisWeekBtn"),

  weekView: document.getElementById("weekView"),
  listView: document.getElementById("listView"),
  focusView: document.getElementById("focusView"),
  dashboardView: document.getElementById("dashboardView"),
  emptyState: document.getElementById("emptyState"),

  weeksAccordion: document.getElementById("weeksAccordion"),
  listTaskList: document.getElementById("listTaskList"),
  focusTaskList: document.getElementById("focusTaskList"),
  dashboardTaskList: document.getElementById("dashboardTaskList"),

  listCountPill: document.getElementById("listCountPill"),
  focusTitlePill: document.getElementById("focusTitlePill"),
  focusCountPill: document.getElementById("focusCountPill"),
  dashboardCountPill: document.getElementById("dashboardCountPill"),
  undoClearBtn: document.getElementById("undoClearBtn"),
  downloadBackupBtn: document.getElementById("downloadBackupBtn"),
  backupFileInput: document.getElementById("backupFileInput"),
  uploadBackupBtn: document.getElementById("uploadBackupBtn"),
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function defaultState() {
  return {
    activeClassId: null,
    viewMode: "week",
    classes: [],
    tasksByClass: {},
    // UI: which weeks are expanded per class (kept in state so handlers may update and render)
    expandedWeeksByClass: {}
  };
}

function loadState() {
  // Try loading from localStorage first (for UI state only)
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_ui');
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Only restore UI-related state, data comes from API
    return {
      ...defaultState(),
      activeClassId: parsed.activeClassId || null,
      viewMode: parsed.viewMode || "week",
      expandedWeeksByClass: parsed.expandedWeeksByClass || {}
    };
  } catch {
    return defaultState();
  }
}

function normalizeState(s) {
  const base = defaultState();
  if (!s || typeof s !== "object") return base;

  if (!Array.isArray(s.classes)) s.classes = [];
  if (!s.tasksByClass || typeof s.tasksByClass !== "object") s.tasksByClass = {};

  if (typeof s.viewMode !== "string") s.viewMode = "week";
  if (typeof s.activeClassId !== "string") s.activeClassId = null;
  if (!s.expandedWeeksByClass || typeof s.expandedWeeksByClass !== "object") s.expandedWeeksByClass = {};

  return { ...base, ...s };
}

function saveUIState() {
  // Only save UI-related state to localStorage
  const uiState = {
    activeClassId: state.activeClassId,
    viewMode: state.viewMode,
    expandedWeeksByClass: state.expandedWeeksByClass
  };
  localStorage.setItem(STORAGE_KEY + '_ui', JSON.stringify(uiState));
}

// Alias for compatibility
function saveState() {
  saveUIState();
}

let state = loadState();

// in-memory last clear (not persisted)
let lastClear = { classId: null, taskIds: [] };

// In-memory UI state for dashboard overdue accordion (collapsed by default)
let dashboardOverdueExpanded = false;
// In-memory UI state for "Due This Week" accordion (collapsed by default)
let dashboardThisWeekExpanded = false;
// In-memory UI state for "Due Today" accordion (collapsed by default)
let dashboardDueTodayExpanded = false;
// In-memory UI state for "Due Next Week" accordion (collapsed by default)
let dashboardDueNextWeekExpanded = false;

// In-memory only: which weeks are expanded per class. This is NOT persisted.
let uiExpandedWeeksByClass = {};

// ============== API Data Functions ==============

async function loadDataFromAPI() {
  try {
    const data = await apiCall('/state');
    state.classes = data.classes || [];
    state.tasksByClass = data.tasksByClass || {};
    
    // Validate activeClassId still exists
    if (state.activeClassId && !state.classes.find(c => c.id === state.activeClassId)) {
      state.activeClassId = null;
    }
    
    render();
  } catch (error) {
    console.error('Failed to load data from API:', error);
    // Show error to user
    els.activeClassTitle.textContent = "Connection Error";
    els.activeClassSubtitle.textContent = "Failed to connect to server. Please refresh the page.";
  }
}

// Backup: download current state as JSON file
async function downloadBackup() {
  try {
    const backup = await apiCall('/backup');
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname = `homework-tracker-backup-${toISODate(new Date())}.json`;
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('Failed to download backup: ' + error.message);
  }
}

// Backup: upload/restore from a JSON file selected by the user
async function uploadBackupFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== "object" || !parsed.state) throw new Error("Invalid backup structure");
      const s = parsed.state;
      if (!Array.isArray(s.classes) || typeof s.tasksByClass !== "object") throw new Error("Invalid state in backup");

      if (!confirm("This will replace your current tracker data. Continue?")) return;

      await apiCall('/backup', {
        method: 'POST',
        body: JSON.stringify(parsed)
      });
      
      // Reload data from API
      await loadDataFromAPI();
    } catch (err) {
      alert("Failed to import backup: " + (err && err.message ? err.message : "invalid file"));
    }
  };
  reader.onerror = () => { alert("Failed to read file"); };
  reader.readAsText(file);
}

// --- Date helpers ---
function pad2(n){ return String(n).padStart(2, "0"); }

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function parseISODate(s) {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatMDY(iso) {
  const d = parseISODate(iso);
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(0,0,0,0);
  return end;
}

function fmtRange(start, end) {
  const s = `${start.getMonth()+1}/${start.getDate()}`;
  const e = `${end.getMonth()+1}/${end.getDate()}`;
  return `${s}–${e}`;
}

function inRange(date, start, end) {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function clampToSemester(date) {
  if (date.getTime() < SEMESTER_START.getTime()) return new Date(SEMESTER_START);
  if (date.getTime() > SEMESTER_END.getTime()) return new Date(SEMESTER_END);
  return date;
}

function buildWeeks() {
  const weeks = [];
  let cursor = startOfWeekMonday(SEMESTER_START);
  const lastWeekStart = startOfWeekMonday(SEMESTER_END);

  let weekNum = 1;
  while (cursor.getTime() <= lastWeekStart.getTime()) {
    const start = new Date(cursor);
    const end = endOfWeekSunday(start);

    weeks.push({
      weekNum,
      start,
      end,
      id: `w${weekNum}`,
      title: `Week ${weekNum}`,
      subtitle: fmtRange(start, end)
    });

    cursor.setDate(cursor.getDate() + 7);
    weekNum++;
  }
  return weeks;
}

const WEEKS = buildWeeks();

function activeClass() {
  return state.classes.find(c => c.id === state.activeClassId) || null;
}

function tasksForActive() {
  const cls = activeClass();
  if (!cls) return [];
  return state.tasksByClass[cls.id] || [];
}

function setView(mode) {
  state.viewMode = mode;
  render();
}

function renderClassTabs() {
  els.classTabs.innerHTML = "";
  // Dashboard tab
  const dash = document.createElement("button");
  dash.className = "class-tab";
  dash.type = "button";
  dash.textContent = "Dashboard";
  dash.onclick = () => { state.viewMode = "dashboard"; render(); };
  // Dashboard is active when viewMode === 'dashboard'
  if (state.viewMode === "dashboard") dash.classList.add("active");
  els.classTabs.appendChild(dash);

  if (state.classes.length === 0) {
    const hint = document.createElement("span");
    hint.className = "text-muted small";
    hint.textContent = "Add a class to begin →";
    els.classTabs.appendChild(hint);
    return;
  }

  state.classes.forEach(cls => {
    const tab = document.createElement("button");
    tab.className = "class-tab";
    // Only show a class as active when we're not in dashboard view
    if (state.viewMode !== "dashboard" && cls.id === state.activeClassId) tab.classList.add("active");
    tab.type = "button";
    tab.textContent = cls.name;
    tab.onclick = () => {
      // Reset any in-memory expanded-week memory for this class so
      // renderWeekView will auto-open the current week on navigation.
      delete uiExpandedWeeksByClass[cls.id];

      state.activeClassId = cls.id;
      state.viewMode = "week";
      render();
    };
    els.classTabs.appendChild(tab);
  });
}

function renderHeader() {
  // When in Dashboard view, show Dashboard header and disable add-task inputs
  if (state.viewMode === "dashboard") {
    els.taskTitleInput.disabled = true;
    els.taskDueInput.disabled = true;
    els.addTaskBtn.disabled = true;
    els.activeClassTitle.textContent = "Dashboard";
    els.activeClassSubtitle.textContent = "Tasks due today across all classes.";
    els.clearCompletedBtn.disabled = true;
    els.undoClearBtn.classList.add("d-none");
    return;
  }

  const cls = activeClass();
  const hasActive = Boolean(cls);

  els.taskTitleInput.disabled = !hasActive;
  els.taskDueInput.disabled = !hasActive;
  els.addTaskBtn.disabled = !hasActive;

  if (!hasActive) {
    els.activeClassTitle.textContent = "Select a class";
    els.activeClassSubtitle.textContent = "Add a class up top to begin.";
    els.clearCompletedBtn.disabled = true;
    els.undoClearBtn.classList.add("d-none");
    return;
  }

  els.activeClassTitle.textContent = cls.name;

  els.activeClassSubtitle.textContent =
    `Semester weeks auto-built (${formatMDY(toISODate(SEMESTER_START))} → ${formatMDY(toISODate(SEMESTER_END))}). Due date decides the week.`;

  if (!els.taskDueInput.value) {
    const today = clampToSemester(new Date());
    els.taskDueInput.value = toISODate(today);
  }

  // Only consider visible completed tasks for Clear Completed
  const visibleCompleted = tasksForActive().some(t => t.done && !t.hidden);
  els.clearCompletedBtn.disabled = !visibleCompleted;

  // Show Undo when lastClear applies to this active class
  if (lastClear.classId === (cls && cls.id) && Array.isArray(lastClear.taskIds) && lastClear.taskIds.length > 0) {
    els.undoClearBtn.classList.remove("d-none");
  } else {
    els.undoClearBtn.classList.add("d-none");
  }
}

function renderViewButtons() {
  const buttons = [
    [els.viewWeekBtn, "week"],
    [els.viewListBtn, "list"],
    [els.viewTodayBtn, "today"],
    [els.viewThisWeekBtn, "thisWeek"],
  ];
  buttons.forEach(([btn, mode]) => {
    if (!btn) return;
    btn.classList.toggle("active", state.viewMode === mode);
  });
}

function taskRow(task, classId) {
  const row = document.createElement("div");
  row.className = "task-row";

  const left = document.createElement("div");
  left.className = "task-left";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "form-check-input mt-1";
  cb.checked = !!task.done;
  cb.onchange = async (e) => { 
    e.stopPropagation(); 
    task.done = cb.checked;
    try {
      await apiCall(`/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ done: task.done })
      });
      render();
    } catch (error) {
      task.done = !cb.checked; // Revert on error
      cb.checked = task.done;
      alert('Failed to update task: ' + error.message);
    }
  };

  const textWrap = document.createElement("div");
  textWrap.style.minWidth = "0";

  // click-to-edit title
  const title = document.createElement("button");
  title.type = "button";
  title.className = "task-title btn btn-link p-0 text-start";
  title.style.textDecoration = "none";
  title.style.color = "inherit";
  if (task.done) title.classList.add("done");
  title.textContent = task.title;

  title.onclick = (e) => { e.stopPropagation();
    const edit = document.createElement("input");
    edit.type = "text";
    edit.className = "form-control form-control-sm";
    edit.value = task.title;

    const save = async () => {
      const v = edit.value.trim();
      if (v && v !== task.title) {
        const oldTitle = task.title;
        task.title = v;
        try {
          await apiCall(`/tasks/${task.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: v })
          });
        } catch (error) {
          task.title = oldTitle;
          alert('Failed to update task: ' + error.message);
        }
      }
      render();
    };

    edit.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") render();
    });
    edit.addEventListener("blur", save);

    textWrap.replaceChild(edit, title);
    edit.focus();
    edit.select();
  };

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const dueBtn = document.createElement("button");
  dueBtn.type = "button";
  dueBtn.className = "icon-btn";
  dueBtn.textContent = `Due: ${formatMDY(task.dueDate)}`;
  dueBtn.title = "Click to change due date";

  dueBtn.onclick = (e) => { e.stopPropagation();
    const picker = document.createElement("input");
    picker.type = "date";
    picker.className = "form-control form-control-sm";
    picker.value = task.dueDate;

    picker.onchange = async () => {
      if (!picker.value) return;
      const picked = clampToSemester(parseISODate(picker.value));
      const newDate = toISODate(picked);
      const oldDate = task.dueDate;
      task.dueDate = newDate;
      try {
        await apiCall(`/tasks/${task.id}`, {
          method: 'PUT',
          body: JSON.stringify({ dueDate: newDate })
        });
        render();
      } catch (error) {
        task.dueDate = oldDate;
        alert('Failed to update task: ' + error.message);
        render();
      }
    };

    meta.innerHTML = "";
    meta.appendChild(picker);
    picker.focus();
  };

  meta.appendChild(dueBtn);

  textWrap.appendChild(title);
  textWrap.appendChild(meta);

  left.appendChild(cb);
  left.appendChild(textWrap);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-btn";
  del.textContent = "Delete";
  del.onclick = async (e) => { e.stopPropagation(); await removeTask(classId, task.id); };

  actions.appendChild(del);

  row.appendChild(left);
  row.appendChild(actions);

  return row;
}

function renderWeekView() {
  const cls = activeClass();
  els.weeksAccordion.innerHTML = "";
  if (!cls) return;

  // determine current week id for initial auto-open
  const today = new Date();
  today.setHours(0,0,0,0);
  const currentWeek = WEEKS.find(wk => inRange(today, wk.start, wk.end));
  const currentWeekId = currentWeek ? currentWeek.id : null;

  // If this class has no in-memory expanded-week record yet, auto-open
  // the current week in-memory only (do NOT persist this).
  if (!uiExpandedWeeksByClass[cls.id] || Object.keys(uiExpandedWeeksByClass[cls.id]).length === 0) {
    uiExpandedWeeksByClass[cls.id] = {};
    if (currentWeekId) uiExpandedWeeksByClass[cls.id][currentWeekId] = true;
  }

  const tasks = tasksForActive()
    .filter(t => !t.hidden)
    .slice()
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt);

  const buckets = new Map();
  WEEKS.forEach(w => buckets.set(w.id, []));
  tasks.forEach(t => {
    const d = parseISODate(t.dueDate);
    const w = WEEKS.find(wk => inRange(d, wk.start, wk.end));
    if (w) buckets.get(w.id).push(t);
  });

  WEEKS.forEach((w) => {
    const weekTasks = buckets.get(w.id) || [];
    const doneCount = weekTasks.filter(t => t.done).length;

    const pct = weekTasks.length === 0 ? 0 : Math.round((doneCount / weekTasks.length) * 100);
    const label =
      weekTasks.length === 0 ? "Empty" :
      pct === 100 ? "Complete" :
      pct >= 50 ? "In progress" : "Started";

    const headerId = `heading-${w.id}`;
    const collapseId = `collapse-${w.id}`;

    const item = document.createElement("div");
    item.className = "accordion-item";

    const h2 = document.createElement("h2");
    h2.className = "accordion-header";
    h2.id = headerId;

    // Prefer the in-memory UI map; fall back to persisted state if needed.
    const expandedForClass = uiExpandedWeeksByClass[cls.id] || state.expandedWeeksByClass[cls.id] || {};
    const isExpanded = !!expandedForClass[w.id];

    const btn = document.createElement("button");
    btn.className = "accordion-button";
    if (!isExpanded) btn.classList.add("collapsed");
    btn.type = "button";
    btn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    btn.setAttribute("aria-controls", collapseId);

    // Controlled toggle: update state then re-render. This ensures expand/collapse
    // only happens when the user clicks the header and is preserved across renders.
    btn.onclick = () => {
      // Update in-memory expanded-week map only (do NOT persist).
      const map = uiExpandedWeeksByClass || {};
      const clsMap = map[cls.id] || {};
      const was = !!clsMap[w.id];
      if (was) {
        clsMap[w.id] = false;
      } else {
        Object.keys(clsMap).forEach(k => { clsMap[k] = false; });
        clsMap[w.id] = true;
      }
      map[cls.id] = clsMap;
      uiExpandedWeeksByClass = map;
      render();
    };

    btn.innerHTML = `
      <div class="d-flex flex-wrap align-items-center justify-content-between w-100 gap-2">
        <div>
          <div class="fw-semibold">${w.title}</div>
          <div class="small text-muted">${w.subtitle}</div>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <div class="progress-pill" aria-label="${label}">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="progress-label">${label}</span>
        </div>
      </div>
    `;

    h2.appendChild(btn);

    const collapse = document.createElement("div");
    collapse.id = collapseId;
    collapse.className = isExpanded ? "accordion-collapse collapse show" : "accordion-collapse collapse";
    collapse.setAttribute("aria-labelledby", headerId);

    const body = document.createElement("div");
    body.className = "accordion-body";

    if (weekTasks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-muted small";
      empty.textContent = "No tasks due this week.";
      body.appendChild(empty);
    } else {
      weekTasks.forEach(t => body.appendChild(taskRow(t, cls.id)));
    }

    collapse.appendChild(body);

    item.appendChild(h2);
    item.appendChild(collapse);

    els.weeksAccordion.appendChild(item);
  });
}

function renderListView() {
  const cls = activeClass();
  els.listTaskList.innerHTML = "";
  if (!cls) return;

  const tasks = tasksForActive().filter(t => !t.hidden)
    .slice()
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt);

  els.listCountPill.textContent = `${tasks.length} tasks`;

  if (tasks.length === 0) {
    const li = document.createElement("li");
    li.className = "list-group-item text-muted";
    li.textContent = "No tasks yet.";
    els.listTaskList.appendChild(li);
    return;
  }

  tasks.forEach(t => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.appendChild(taskRow(t, cls.id));
    els.listTaskList.appendChild(li);
  });
}

function renderDashboardView() {
  els.dashboardTaskList.innerHTML = "";

  const today = new Date();
  today.setHours(0,0,0,0);

  // gather overdue tasks (due before today) across all classes
  const overdue = [];
  state.classes.forEach(cls => {
    const tasks = state.tasksByClass[cls.id] || [];
    tasks.forEach(t => {
      const due = parseISODate(t.dueDate);
      if (!t.done && t.hidden !== true && due.getTime() < today.getTime()) {
        overdue.push({ classId: cls.id, className: cls.name, task: t });
      }
    });
  });

  // Dashboard count shows only today's tasks; build that list separately
  const iso = toISODate(today);
  const items = [];
  state.classes.forEach(cls => {
    const tasks = state.tasksByClass[cls.id] || [];
    tasks.forEach(t => {
      if (t.dueDate === iso && !t.hidden) items.push({ classId: cls.id, className: cls.name, task: t });
    });
  });

  els.dashboardCountPill.textContent = `${items.length} tasks`;

  // --- Overdue accordion (Dashboard only) ---
  const liOverdue = document.createElement("li");
  liOverdue.className = "list-group-item";

  const acc = document.createElement("div");
  acc.className = "accordion";
  acc.id = "dashboardOverdueAccordion";

  const item = document.createElement("div");
  item.className = "accordion-item";

  const h2 = document.createElement("h2");
  h2.className = "accordion-header";
  h2.id = "heading-overdue";

  const btn = document.createElement("button");
  btn.className = "accordion-button";
  if (!dashboardOverdueExpanded) btn.classList.add("collapsed");
  btn.type = "button";
  btn.setAttribute("aria-expanded", dashboardOverdueExpanded ? "true" : "false");
  btn.setAttribute("aria-controls", "collapse-overdue");

  btn.onclick = (e) => {
    // toggle in-memory only
    dashboardOverdueExpanded = !dashboardOverdueExpanded;
    render();
  };

  btn.innerHTML = `
    <div class="d-flex align-items-center justify-content-between w-100">
      <div>
        <div class="fw-semibold">Overdue</div>
        <div class="small text-muted">Needs attention</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge overdue-count">${overdue.length}</span>
      </div>
    </div>
  `;

  h2.appendChild(btn);

  const collapse = document.createElement("div");
  collapse.id = "collapse-overdue";
  collapse.className = dashboardOverdueExpanded ? "accordion-collapse collapse show" : "accordion-collapse collapse";
  collapse.setAttribute("aria-labelledby", "heading-overdue");

  const body = document.createElement("div");
  body.className = "accordion-body";

  if (overdue.length === 0) {
    const none = document.createElement("div");
    none.className = "small text-muted";
    none.textContent = "No overdue tasks.";
    body.appendChild(none);
  } else {
    // render each overdue task (taskRow provides checkbox handling)
    overdue.forEach(it => {
      const wrapper = document.createElement("div");
      wrapper.appendChild(taskRow(it.task, it.classId));
      const classLabel = document.createElement("div");
      classLabel.className = "small text-muted mb-1";
      classLabel.textContent = it.className;
      wrapper.insertBefore(classLabel, wrapper.firstChild);
      body.appendChild(wrapper);
    });
  }

  collapse.appendChild(body);
  item.appendChild(h2);
  item.appendChild(collapse);
  acc.appendChild(item);

  liOverdue.appendChild(acc);
  els.dashboardTaskList.appendChild(liOverdue);

  // --- Due This Week accordion (Dashboard only) ---
  const startWeek = startOfWeekMonday(today);
  const endWeek = endOfWeekSunday(today);

  const thisWeekItems = [];
  state.classes.forEach(cls => {
    const tasks = state.tasksByClass[cls.id] || [];
    tasks.forEach(t => {
      if (t.done || t.hidden === true) return;
      const due = parseISODate(t.dueDate);
      // exclude overdue (due < today)
      if (due.getTime() < today.getTime()) return;
      if (inRange(due, startWeek, endWeek)) {
        thisWeekItems.push({ classId: cls.id, className: cls.name, task: t });
      }
    });
  });

  // sort by due date then class name
  thisWeekItems.sort((a,b) => {
    const d = a.task.dueDate.localeCompare(b.task.dueDate);
    if (d !== 0) return d;
    return a.className.localeCompare(b.className);
  });

  const liThisWeek = document.createElement("li");
  liThisWeek.className = "list-group-item";

  // --- Due Today accordion (Dashboard only) ---
  const liDueToday = document.createElement("li");
  liDueToday.className = "list-group-item";

  const accToday = document.createElement("div");
  accToday.className = "accordion";
  accToday.id = "dashboardDueTodayAccordion";

  const itemToday = document.createElement("div");
  itemToday.className = "accordion-item";

  const h2t = document.createElement("h2");
  h2t.className = "accordion-header";
  h2t.id = "heading-duetoday";

  const btnt = document.createElement("button");
  btnt.className = "accordion-button";
  if (!dashboardDueTodayExpanded) btnt.classList.add("collapsed");
  btnt.type = "button";
  btnt.setAttribute("aria-expanded", dashboardDueTodayExpanded ? "true" : "false");
  btnt.setAttribute("aria-controls", "collapse-duetoday");

  btnt.onclick = (e) => {
    dashboardDueTodayExpanded = !dashboardDueTodayExpanded;
    render();
  };

  btnt.innerHTML = `
    <div class="d-flex align-items-center justify-content-between w-100">
      <div>
        <div class="fw-semibold">Due Today</div>
        <div class="small text-muted">Tasks due today</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge today-count">${items.length}</span>
      </div>
    </div>
  `;

  h2t.appendChild(btnt);

  const collapseT = document.createElement("div");
  collapseT.id = "collapse-duetoday";
  collapseT.className = dashboardDueTodayExpanded ? "accordion-collapse collapse show" : "accordion-collapse collapse";
  collapseT.setAttribute("aria-labelledby", "heading-duetoday");

  const bodyT = document.createElement("div");
  bodyT.className = "accordion-body";

  if (items.length === 0) {
    const none = document.createElement("div");
    none.className = "small text-muted";
    none.textContent = "No tasks due today.";
    bodyT.appendChild(none);
  } else {
    // group by class for readability
    const byClassT = new Map();
    items.forEach(it => {
      if (!byClassT.has(it.classId)) byClassT.set(it.classId, { name: it.className, tasks: [] });
      byClassT.get(it.classId).tasks.push(it.task);
    });

    Array.from(byClassT.values()).sort((a,b) => a.name.localeCompare(b.name)).forEach(group => {
      const clsHdr = document.createElement("div");
      clsHdr.className = "small text-muted mb-1";
      clsHdr.textContent = group.name;
      bodyT.appendChild(clsHdr);

      group.tasks.forEach(t => bodyT.appendChild(taskRow(t, (() => {
        for (const c of state.classes) {
          const arr = state.tasksByClass[c.id] || [];
          if (arr.some(x => x.id === t.id)) return c.id;
        }
        return null;
      })())));
    });
  }

  collapseT.appendChild(bodyT);
  itemToday.appendChild(h2t);
  itemToday.appendChild(collapseT);
  accToday.appendChild(itemToday);
  liDueToday.appendChild(accToday);
  // insert Due Today before This Week
  els.dashboardTaskList.appendChild(liDueToday);

  const accWeek = document.createElement("div");
  accWeek.className = "accordion";
  accWeek.id = "dashboardThisWeekAccordion";

  const itemWeek = document.createElement("div");
  itemWeek.className = "accordion-item";

  const h2w = document.createElement("h2");
  h2w.className = "accordion-header";
  h2w.id = "heading-thisweek";

  const btnw = document.createElement("button");
  btnw.className = "accordion-button";
  if (!dashboardThisWeekExpanded) btnw.classList.add("collapsed");
  btnw.type = "button";
  btnw.setAttribute("aria-expanded", dashboardThisWeekExpanded ? "true" : "false");
  btnw.setAttribute("aria-controls", "collapse-thisweek");

  btnw.onclick = (e) => {
    dashboardThisWeekExpanded = !dashboardThisWeekExpanded;
    render();
  };

  btnw.innerHTML = `
    <div class="d-flex align-items-center justify-content-between w-100">
      <div>
        <div class="fw-semibold">Due This Week</div>
        <div class="small text-muted">Tasks due this calendar week</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge thisweek-count text-muted">${thisWeekItems.length}</span>
      </div>
    </div>
  `;

  h2w.appendChild(btnw);

  const collapseW = document.createElement("div");
  collapseW.id = "collapse-thisweek";
  collapseW.className = dashboardThisWeekExpanded ? "accordion-collapse collapse show" : "accordion-collapse collapse";
  collapseW.setAttribute("aria-labelledby", "heading-thisweek");

  const bodyW = document.createElement("div");
  bodyW.className = "accordion-body";

  if (thisWeekItems.length === 0) {
    const none = document.createElement("div");
    none.className = "small text-muted";
    none.textContent = "Nothing due this week.";
    bodyW.appendChild(none);
  } else {
    // group by class for readability
    const byClass = new Map();
    thisWeekItems.forEach(it => {
      if (!byClass.has(it.classId)) byClass.set(it.classId, { name: it.className, tasks: [] });
      byClass.get(it.classId).tasks.push(it.task);
    });

    // iterate classes in alphabetical order
    Array.from(byClass.values()).sort((a,b) => a.name.localeCompare(b.name)).forEach(group => {
      const clsHdr = document.createElement("div");
      clsHdr.className = "small text-muted mb-1";
      clsHdr.textContent = group.name;
      bodyW.appendChild(clsHdr);

      group.tasks.forEach(t => bodyW.appendChild(taskRow(t, /* unknown classId here; taskRow only needs classId for delete */ (() => {
        // find class id for this task (small lookup)
        for (const c of state.classes) {
          const arr = state.tasksByClass[c.id] || [];
          if (arr.some(x => x.id === t.id)) return c.id;
        }
        return null;
      })())));
    });
  }

  collapseW.appendChild(bodyW);
  itemWeek.appendChild(h2w);
  itemWeek.appendChild(collapseW);
  accWeek.appendChild(itemWeek);
  liThisWeek.appendChild(accWeek);
  els.dashboardTaskList.appendChild(liThisWeek);

  // --- Due Next Week accordion (Dashboard only) ---
  const nextStart = new Date(startWeek);
  nextStart.setDate(nextStart.getDate() + 7);
  nextStart.setHours(0,0,0,0);
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextStart.getDate() + 6);
  nextEnd.setHours(0,0,0,0);

  const nextWeekItems = [];
  state.classes.forEach(cls => {
    const tasks = state.tasksByClass[cls.id] || [];
    tasks.forEach(t => {
      if (t.done || t.hidden === true) return;
      const due = parseISODate(t.dueDate);
      // exclude overdue, today, and this week
      if (due.getTime() < today.getTime()) return;
      if (inRange(due, startWeek, endWeek)) return;
      if (due.getTime() === today.getTime()) return;
      if (inRange(due, nextStart, nextEnd)) {
        nextWeekItems.push({ classId: cls.id, className: cls.name, task: t });
      }
    });
  });

  // sort same as other lists
  nextWeekItems.sort((a,b) => {
    const d = a.task.dueDate.localeCompare(b.task.dueDate);
    if (d !== 0) return d;
    return a.className.localeCompare(b.className);
  });

  const liNextWeek = document.createElement("li");
  liNextWeek.className = "list-group-item";

  const accNext = document.createElement("div");
  accNext.className = "accordion";
  accNext.id = "dashboardNextWeekAccordion";

  const itemNext = document.createElement("div");
  itemNext.className = "accordion-item";

  const h2n = document.createElement("h2");
  h2n.className = "accordion-header";
  h2n.id = "heading-nextweek";

  const btnn = document.createElement("button");
  btnn.className = "accordion-button";
  if (!dashboardDueNextWeekExpanded) btnn.classList.add("collapsed");
  btnn.type = "button";
  btnn.setAttribute("aria-expanded", dashboardDueNextWeekExpanded ? "true" : "false");
  btnn.setAttribute("aria-controls", "collapse-nextweek");

  btnn.onclick = (e) => {
    dashboardDueNextWeekExpanded = !dashboardDueNextWeekExpanded;
    render();
  };

  btnn.innerHTML = `
    <div class="d-flex align-items-center justify-content-between w-100">
      <div>
        <div class="fw-semibold">Due Next Week</div>
        <div class="small text-muted">Tasks due next calendar week</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge nextweek-count text-muted">${nextWeekItems.length}</span>
      </div>
    </div>
  `;

  h2n.appendChild(btnn);

  const collapseN = document.createElement("div");
  collapseN.id = "collapse-nextweek";
  collapseN.className = dashboardDueNextWeekExpanded ? "accordion-collapse collapse show" : "accordion-collapse collapse";
  collapseN.setAttribute("aria-labelledby", "heading-nextweek");

  const bodyN = document.createElement("div");
  bodyN.className = "accordion-body";

  if (nextWeekItems.length === 0) {
    const none = document.createElement("div");
    none.className = "small text-muted";
    none.textContent = "No tasks due next week.";
    bodyN.appendChild(none);
  } else {
    const byClassN = new Map();
    nextWeekItems.forEach(it => {
      if (!byClassN.has(it.classId)) byClassN.set(it.classId, { name: it.className, tasks: [] });
      byClassN.get(it.classId).tasks.push(it.task);
    });

    // Sort tasks within each class by due date, then sort class groups by
    // the earliest due date in that group so the accordion shows earliest
    // upcoming dates first while preserving the same structure as "Due This Week".
    const groups = Array.from(byClassN.values());
    groups.forEach(g => g.tasks.sort((x,y) => x.dueDate.localeCompare(y.dueDate)));
    groups.sort((a,b) => {
      const ta = parseISODate(a.tasks[0].dueDate).getTime();
      const tb = parseISODate(b.tasks[0].dueDate).getTime();
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });

    groups.forEach(group => {
      const clsHdr = document.createElement("div");
      clsHdr.className = "small text-muted mb-1";
      clsHdr.textContent = group.name;
      bodyN.appendChild(clsHdr);

      group.tasks.forEach(t => bodyN.appendChild(taskRow(t, (() => {
        for (const c of state.classes) {
          const arr = state.tasksByClass[c.id] || [];
          if (arr.some(x => x.id === t.id)) return c.id;
        }
        return null;
      })())));
    });
  }

  collapseN.appendChild(bodyN);
  itemNext.appendChild(h2n);
  itemNext.appendChild(collapseN);
  accNext.appendChild(itemNext);
  liNextWeek.appendChild(accNext);
  els.dashboardTaskList.appendChild(liNextWeek);

  // Today's items are shown inside the "Due Today" accordion above.
}

function renderFocusView(mode) {
  const cls = activeClass();
  els.focusTaskList.innerHTML = "";
  if (!cls) return;

  const today = new Date();
  today.setHours(0,0,0,0);

  const startWeek = startOfWeekMonday(today);
  const endWeek = endOfWeekSunday(today);

  let filtered = [];
  const tasks = tasksForActive().filter(t => !t.hidden);

  if (mode === "today") {
    const iso = toISODate(today);
    els.focusTitlePill.textContent = "Today";
    filtered = tasks.filter(t => t.dueDate === iso);
  } else {
    els.focusTitlePill.textContent = "This Week";
    filtered = tasks.filter(t => {
      const d = parseISODate(t.dueDate);
      return inRange(d, startWeek, endWeek);
    });
  }

  filtered.sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt);
  els.focusCountPill.textContent = `${filtered.length} tasks`;

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "list-group-item text-muted";
    li.textContent = mode === "today" ? "Nothing due today." : "Nothing due this week.";
    els.focusTaskList.appendChild(li);
    return;
  }

  filtered.forEach(t => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.appendChild(taskRow(t, cls.id));
    els.focusTaskList.appendChild(li);
  });
}

function render() {
  renderClassTabs();
  renderHeader();
  renderViewButtons();

  const hasClass = Boolean(activeClass());

  els.emptyState.classList.toggle("d-none", hasClass);

  els.weekView.classList.add("d-none");
  els.listView.classList.add("d-none");
  els.focusView.classList.add("d-none");
  els.dashboardView.classList.add("d-none");
  // Dashboard view should show regardless of whether a class is selected
  if (state.viewMode === "dashboard") {
    els.dashboardView.classList.remove("d-none");
    renderDashboardView();
  } else if (hasClass) {
    if (state.viewMode === "week") {
      els.weekView.classList.remove("d-none");
      renderWeekView();
    } else if (state.viewMode === "list") {
      els.listView.classList.remove("d-none");
      renderListView();
    } else if (state.viewMode === "today") {
      els.focusView.classList.remove("d-none");
      renderFocusView("today");
    } else if (state.viewMode === "thisWeek") {
      els.focusView.classList.remove("d-none");
      renderFocusView("thisWeek");
    }
  }

  saveState();
}

async function addClass(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;

  try {
    const newCls = await apiCall('/classes', {
      method: 'POST',
      body: JSON.stringify({ name: trimmed })
    });
    
    state.classes.push(newCls);
    state.tasksByClass[newCls.id] = [];
    state.activeClassId = newCls.id;
    state.viewMode = "week";

    els.classNameInput.value = "";
    render();
  } catch (error) {
    alert('Failed to add class: ' + error.message);
  }
}

async function addTask(title, dueDateISO) {
  const cls = activeClass();
  if (!cls) return;

  const t = (title || "").trim();
  if (!t) return;

  if (!dueDateISO) return;

  const picked = clampToSemester(parseISODate(dueDateISO));
  const finalISO = toISODate(picked);

  try {
    const task = await apiCall(`/classes/${cls.id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ 
        title: t, 
        dueDate: finalISO 
      })
    });

    state.tasksByClass[cls.id].push(task);

    els.taskTitleInput.value = "";
    els.taskTitleInput.focus();

    render();
  } catch (error) {
    alert('Failed to add task: ' + error.message);
  }
}

async function removeTask(classId, taskId) {
  try {
    await apiCall(`/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    state.tasksByClass[classId] = state.tasksByClass[classId].filter(t => t.id !== taskId);
    render();
  } catch (error) {
    alert('Failed to delete task: ' + error.message);
  }
}

async function clearCompleted() {
  const cls = activeClass();
  if (!cls) return;

  try {
    const hiddenIds = await apiCall(`/classes/${cls.id}/tasks/clear-completed`, {
      method: 'POST'
    });
    
    if (hiddenIds.length === 0) return;

    // Update local state
    const tasks = state.tasksByClass[cls.id] || [];
    tasks.forEach(t => {
      if (hiddenIds.includes(t.id)) t.hidden = true;
    });

    // record last clear for undo (in-memory only)
    lastClear = { classId: cls.id, taskIds: hiddenIds };

    render();
  } catch (error) {
    alert('Failed to clear completed: ' + error.message);
  }
}

async function undoClear() {
  if (!lastClear || !lastClear.classId) return;
  
  try {
    await apiCall('/tasks/restore', {
      method: 'POST',
      body: JSON.stringify(lastClear.taskIds)
    });
    
    const tasks = state.tasksByClass[lastClear.classId] || [];
    tasks.forEach(t => {
      if (lastClear.taskIds.includes(t.id)) t.hidden = false;
    });
    
    // clear lastClear
    lastClear = { classId: null, taskIds: [] };
    render();
  } catch (error) {
    alert('Failed to undo clear: ' + error.message);
  }
}

// Wire up
els.addClassBtn.addEventListener("click", () => addClass(els.classNameInput.value));
els.classNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addClass(els.classNameInput.value); }
});

els.addTaskBtn.addEventListener("click", () => addTask(els.taskTitleInput.value, els.taskDueInput.value));
els.taskTitleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addTask(els.taskTitleInput.value, els.taskDueInput.value); }
});
els.taskDueInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addTask(els.taskTitleInput.value, els.taskDueInput.value); }
});

els.clearCompletedBtn.addEventListener("click", clearCompleted);
els.undoClearBtn.addEventListener("click", undoClear);
els.downloadBackupBtn.addEventListener("click", downloadBackup);
els.uploadBackupBtn.addEventListener("click", () => els.backupFileInput.click());
els.backupFileInput.addEventListener("change", (e) => {
  const f = (e.target.files && e.target.files[0]) || null;
  if (f) uploadBackupFile(f);
  // clear selection so same file can be chosen again
  e.target.value = "";
});

if (els.viewWeekBtn) els.viewWeekBtn.addEventListener("click", () => setView("week"));
if (els.viewListBtn) els.viewListBtn.addEventListener("click", () => setView("list"));
if (els.viewTodayBtn) els.viewTodayBtn.addEventListener("click", () => setView("today"));
if (els.viewThisWeekBtn) els.viewThisWeekBtn.addEventListener("click", () => setView("thisWeek"));

// Initialize: load data from API then render
loadDataFromAPI();
