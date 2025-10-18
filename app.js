+const form = document.getElementById("task-form");
+const taskList = document.getElementById("task-list");
+const emptyState = document.getElementById("empty-state");
+const sortToggle = document.getElementById("sort-toggle");
+const clearAllButton = document.getElementById("clear-all");
+const reminderDialog = document.getElementById("reminder-dialog");
+const reminderTitle = document.getElementById("reminder-title");
+const reminderTime = document.getElementById("reminder-time");
+const reminderDescription = document.getElementById("reminder-description");
+const reminderCalendarLink = document.getElementById("reminder-calendar-link");
+const dismissReminder = document.getElementById("dismiss-reminder");
+const template = document.getElementById("task-template");
+
+const STORAGE_KEY = "weekly-reminder-tasks";
+const SORT_KEY = "weekly-reminder-sort";
+const WEEKDAY_MAP = {
+  "یک‌شنبه": 0,
+  "دوشنبه": 1,
+  "سه‌شنبه": 2,
+  "چهارشنبه": 3,
+  "پنج‌شنبه": 4,
+  "جمعه": 5,
+  "شنبه": 6,
+};
+
+const reminderTimeouts = new Map();
+
+const storage = createStorage();
+const storageWarning = document.getElementById("storage-warning");
+
+function createStorage() {
+  let memoryTasks = [];
+  let memorySortPreference = false;
+  let persistent = true;
+
+  const fallback = {
+    loadTasks: () => memoryTasks.map((task) => ({ ...task })),
+    saveTasks: (tasks) => {
+      memoryTasks = tasks.map((task) => ({ ...task }));
+    },
+    loadSortPreference: () => memorySortPreference,
+    saveSortPreference: (enabled) => {
+      memorySortPreference = enabled;
+    },
+  };
+
+  try {
+    const testKey = "weekly-reminder-test";
+    window.localStorage.setItem(testKey, "1");
+    window.localStorage.removeItem(testKey);
+  } catch (error) {
+    console.warn("Local storage is not available; falling back to in-memory storage.", error);
+    persistent = false;
+  }
+
+  function parseTasks(raw) {
+    if (!raw) return [];
+    try {
+      const parsed = JSON.parse(raw);
+      return Array.isArray(parsed) ? parsed : [];
+    } catch (error) {
+      console.error("Failed to parse stored tasks", error);
+      return [];
+    }
+  }
+
+  return {
+    loadTasks() {
+      if (!persistent) {
+        return fallback.loadTasks();
+      }
+      try {
+        return parseTasks(window.localStorage.getItem(STORAGE_KEY));
+      } catch (error) {
+        console.error("Unable to read tasks from local storage", error);
+        persistent = false;
+        return fallback.loadTasks();
+      }
+    },
+    saveTasks(tasks) {
+      if (!persistent) {
+        fallback.saveTasks(tasks);
+        return;
+      }
+      try {
+        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
+      } catch (error) {
+        console.error("Unable to persist tasks", error);
+        persistent = false;
+        fallback.saveTasks(tasks);
+      }
+    },
+    loadSortPreference() {
+      if (!persistent) {
+        return fallback.loadSortPreference();
+      }
+      try {
+        const raw = window.localStorage.getItem(SORT_KEY);
+        return raw === "duration";
+      } catch (error) {
+        console.error("Unable to read sort preference", error);
+        persistent = false;
+        return fallback.loadSortPreference();
+      }
+    },
+    saveSortPreference(enabled) {
+      if (!persistent) {
+        fallback.saveSortPreference(enabled);
+        return;
+      }
+      try {
+        window.localStorage.setItem(SORT_KEY, enabled ? "duration" : "default");
+      } catch (error) {
+        console.error("Unable to persist sort preference", error);
+        persistent = false;
+        fallback.saveSortPreference(enabled);
+      }
+    },
+    isPersistent() {
+      return persistent;
+    },
+  };
+}
+
+function updateStorageWarning() {
+  if (!storageWarning) return;
+  storageWarning.hidden = storage.isPersistent();
+}
+
+function loadTasks() {
+  return storage.loadTasks();
+}
+
+function saveTasks(tasks) {
+  storage.saveTasks(tasks);
+  updateStorageWarning();
+}
+
+function loadSortPreference() {
+  return storage.loadSortPreference();
+}
+
+function saveSortPreference(enabled) {
+  storage.saveSortPreference(enabled);
+  updateStorageWarning();
+}
+
+updateStorageWarning();
+
+function getNextOccurrence(weekday, time) {
+  const now = new Date();
+  const [hour, minute] = time.split(":").map(Number);
+  const nowMinutes = now.getHours() * 60 + now.getMinutes();
+  const targetMinutes = hour * 60 + minute;
+  const currentDay = now.getDay();
+  const targetDay = WEEKDAY_MAP[weekday];
+  let diff = (targetDay - currentDay + 7) % 7;
+  if (diff === 0 && targetMinutes <= nowMinutes) {
+    diff = 7;
+  }
+  const result = new Date(now);
+  result.setHours(hour, minute, 0, 0);
+  result.setDate(result.getDate() + diff);
+  return result;
+}
+
+function formatTime(minutes) {
+  const hours = Math.floor(minutes / 60);
+  const mins = minutes % 60;
+  if (hours === 0) {
+    return `${mins} دقیقه`;
+  }
+  if (mins === 0) {
+    return `${hours} ساعت`;
+  }
+  return `${hours} ساعت و ${mins} دقیقه`;
+}
+
+function formatDateTime(date) {
+  return date.toLocaleString("fa-IR", {
+    weekday: "long",
+    hour: "2-digit",
+    minute: "2-digit",
+  });
+}
+
+function formatForCalendar(date) {
+  const year = date.getFullYear();
+  const month = String(date.getMonth() + 1).padStart(2, "0");
+  const day = String(date.getDate()).padStart(2, "0");
+  const hours = String(date.getHours()).padStart(2, "0");
+  const minutes = String(date.getMinutes()).padStart(2, "0");
+  const seconds = String(date.getSeconds()).padStart(2, "0");
+  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
+}
+
+function buildCalendarUrl(task) {
+  const startDate = getNextOccurrence(task.weekday, task.startTime);
+  const endDate = new Date(startDate.getTime() + task.duration * 60 * 1000);
+  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
+  const params = new URLSearchParams({
+    text: task.title,
+    details: task.description,
+  });
+  params.append("dates", `${formatForCalendar(startDate)}/${formatForCalendar(endDate)}`);
+  return `${base}&${params.toString()}`;
+}
+
+function renderTasks(tasks) {
+  taskList.innerHTML = "";
+  const sortedTasks = [...tasks];
+  if (sortToggle.checked) {
+    sortedTasks.sort((a, b) => a.duration - b.duration);
+  } else {
+    sortedTasks.sort((a, b) => {
+      const dayDiff = WEEKDAY_MAP[a.weekday] - WEEKDAY_MAP[b.weekday];
+      if (dayDiff !== 0) return dayDiff;
+      return a.startTime.localeCompare(b.startTime);
+    });
+  }
+
+  sortedTasks.forEach((task) => {
+    const fragment = template.content.cloneNode(true);
+    const card = fragment.querySelector(".task-card");
+    card.dataset.id = task.id;
+    fragment.querySelector(".task-title").textContent = task.title;
+    fragment.querySelector(".task-meta").textContent = `${task.weekday} • ${task.startTime} • ${formatTime(task.duration)}`;
+    fragment.querySelector(".task-description").textContent = task.description;
+    const calendarLink = fragment.querySelector(".calendar-link");
+    calendarLink.href = buildCalendarUrl(task);
+    const badge = fragment.querySelector(".reminder-badge");
+    badge.textContent = task.reminderOffset ? `یادآوری ${task.reminderOffset} دقیقه قبل` : "یادآوری در زمان شروع";
+    fragment.querySelector(".delete").addEventListener("click", () => deleteTask(task.id));
+    taskList.appendChild(fragment);
+  });
+
+  emptyState.hidden = sortedTasks.length > 0;
+}
+
+function deleteTask(id) {
+  const tasks = loadTasks();
+  const updated = tasks.filter((task) => task.id !== id);
+  saveTasks(updated);
+  cancelReminder(id);
+  renderTasks(updated);
+  scheduleReminders(updated);
+}
+
+function cancelReminder(taskId) {
+  const timeoutId = reminderTimeouts.get(taskId);
+  if (timeoutId) {
+    clearTimeout(timeoutId);
+    reminderTimeouts.delete(taskId);
+  }
+}
+
+function scheduleReminders(tasks) {
+  reminderTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
+  reminderTimeouts.clear();
+
+  const now = Date.now();
+  tasks.forEach((task) => {
+    const startDate = getNextOccurrence(task.weekday, task.startTime);
+    const reminderDate = new Date(startDate.getTime() - task.reminderOffset * 60 * 1000);
+    const delay = reminderDate.getTime() - now;
+    if (delay > 0 && delay <= 1000 * 60 * 60 * 24 * 7) {
+      const timeoutId = setTimeout(() => triggerReminder(task), delay);
+      reminderTimeouts.set(task.id, timeoutId);
+    }
+  });
+}
+
+function triggerReminder(task) {
+  reminderTitle.textContent = task.title;
+  const startDate = getNextOccurrence(task.weekday, task.startTime);
+  reminderTime.textContent = formatDateTime(startDate);
+  reminderDescription.textContent = task.description;
+  reminderCalendarLink.href = buildCalendarUrl(task);
+  if (typeof reminderDialog.showModal === "function") {
+    reminderDialog.showModal();
+  }
+
+  if ("Notification" in window && Notification.permission === "granted") {
+    new Notification(task.title, {
+      body: task.description,
+      tag: task.id,
+    });
+  }
+}
+
+function requestNotificationPermission() {
+  if (!("Notification" in window)) return;
+  if (Notification.permission === "default") {
+    Notification.requestPermission();
+  }
+}
+
+form.addEventListener("submit", (event) => {
+  event.preventDefault();
+  const formData = new FormData(form);
+  const title = (formData.get("title") || "").toString().trim();
+  const weekday = (formData.get("weekday") || "شنبه").toString();
+  const startTime = (formData.get("start-time") || "").toString();
+  const duration = Number(formData.get("duration") || 0);
+  const description = (formData.get("description") || "").toString().trim();
+  const reminderOffset = Number(formData.get("reminder-offset") || 0);
+
+  if (!title || !startTime || !duration || !description) {
+    return;
+  }
+
+  const tasks = loadTasks();
+  const task = {
+    id:
+      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
+        ? crypto.randomUUID()
+        : Math.random().toString(16).slice(2),
+    title,
+    weekday,
+    startTime,
+    duration,
+    description,
+    reminderOffset,
+  };
+  tasks.push(task);
+  saveTasks(tasks);
+  renderTasks(tasks);
+  scheduleReminders(tasks);
+  form.reset();
+});
+
+sortToggle.addEventListener("change", () => {
+  saveSortPreference(sortToggle.checked);
+  renderTasks(loadTasks());
+});
+
+clearAllButton.addEventListener("click", () => {
+  if (confirm("همه کارها حذف شوند؟")) {
+    saveTasks([]);
+    reminderTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
+    reminderTimeouts.clear();
+    renderTasks([]);
+  }
+});
+
+dismissReminder.addEventListener("click", () => {
+  reminderDialog.close();
+});
+
+window.addEventListener("DOMContentLoaded", () => {
+  const tasks = loadTasks();
+  sortToggle.checked = loadSortPreference();
+  renderTasks(tasks);
+  scheduleReminders(tasks);
+  requestNotificationPermission();
+  updateStorageWarning();
+});
