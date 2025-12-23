// 簡單 TOEIC 練習前端邏輯

const STORAGE_KEYS = {
  USERS: "toeic_users", // 使用者列表 [{ id, name, createdAt }]
  CURRENT_USER: "toeic_current_user", // 當前使用者 ID
  WRONG_QUESTIONS: "toeic_wrong_questions", // 舊版，保留相容性
  EXAM_STATS: "toeic_exam_stats", // 舊版，保留相容性
  PROGRESS: "toeic_progress", // 舊版，保留相容性
};

// 使用者資料相關的 storage key 生成函數
function getUserStorageKey(userId, key) {
  return `toeic_user_${userId}_${key}`;
}

// 答題進度相關的 storage key
function getProgressStorageKey(userId) {
  return getUserStorageKey(userId, "progress");
}

const state = {
  allQuestions: [],
  currentSet: [],
  currentIndex: 0,
  mode: null, // "all" | "exam" | "review"
  wrongQuestions: [], // 本輪錯題
  allWrongQuestions: [], // 累積所有錯題（從 localStorage 載入）
  currentQuestionAnswered: false,
  // 每回合統計（本輪作答時用）
  perExamTotals: {}, // { [examId]: totalAnswered }
  perExamWrongs: {}, // { [examId]: wrongCount }
  // 累積統計（從 localStorage 載入）
  cumulativeStats: {}, // { [examId]: { total: number, correct: number, wrong: number } }
  // 使用者相關
  currentUserId: null, // 當前使用者 ID
  users: [], // 使用者列表
};

// DOM
const $ = (id) => document.getElementById(id);

const modeAllBtn = $("mode-all");
const modeExamBtn = $("mode-exam");
const modeReviewBtn = $("mode-review");
const examSelector = $("exam-selector");
const examSelect = $("exam-select");
const startExamBtn = $("start-exam");

const statMode = $("stat-mode");
const statProgress = $("stat-progress");
const statCorrect = $("stat-correct");
const statWrong = $("stat-wrong");

const questionPanel = $("question-panel");
const questionLabel = $("question-label");
const questionMeta = $("question-meta");
const questionImage = $("question-image");
const questionText = $("question-text");
const optionsContainer = $("options");
const feedbackBox = $("feedback");
const feedbackResult = $("feedback-result");
const feedbackCorrect = $("feedback-correct");
const btnNext = $("btn-next");

const summaryPanel = $("summary-panel");
const summaryText = $("summary-text");
const summaryExtra = $("summary-extra");
const analysisPanel = $("analysis-panel");
const analysisContent = $("analysis-content");
const btnOpenAnalysis = $("btn-open-analysis");
const btnAnalysisBack = $("btn-analysis-back");
const btnPracticeAllWrong = $("btn-practice-all-wrong");
const btnClearHistory = $("btn-clear-history");

// 使用者相關 DOM
const currentUserDisplay = $("current-user-display");
const btnUserMenu = $("btn-user-menu");
const userPanel = $("user-panel");
const userList = $("user-list");
const newUserName = $("new-user-name");
const btnAddUser = $("btn-add-user");
const btnUserClose = $("btn-user-close");
const btnExportData = $("btn-export-data");
const btnImportData = $("btn-import-data");

// 使用者管理
function loadUsers() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (data) {
      state.users = JSON.parse(data);
    } else {
      // 如果沒有使用者，建立一個預設使用者
      const defaultUser = createUser("預設使用者");
      state.users = [defaultUser];
      saveUsers();
      state.currentUserId = defaultUser.id;
      saveCurrentUser();
    }
  } catch (e) {
    console.error("載入使用者列表失敗", e);
    state.users = [];
  }
}

function saveUsers() {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
  } catch (e) {
    console.error("保存使用者列表失敗", e);
  }
}

function loadCurrentUser() {
  try {
    const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (userId && state.users.find((u) => u.id === userId)) {
      state.currentUserId = userId;
    } else if (state.users.length > 0) {
      // 如果當前使用者不存在，選擇第一個使用者
      state.currentUserId = state.users[0].id;
      saveCurrentUser();
    }
  } catch (e) {
    console.error("載入當前使用者失敗", e);
  }
}

function saveCurrentUser() {
  try {
    if (state.currentUserId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, state.currentUserId);
    }
  } catch (e) {
    console.error("保存當前使用者失敗", e);
  }
}

function createUser(name) {
  return {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim() || "未命名使用者",
    createdAt: new Date().toISOString(),
  };
}

function addUser(name) {
  if (!name || !name.trim()) {
    alert("請輸入使用者名稱");
    return;
  }
  const newUser = createUser(name);
  state.users.push(newUser);
  saveUsers();
  renderUserList();
  // 自動切換到新使用者
  switchUser(newUser.id);
}

function deleteUser(userId) {
  if (state.users.length <= 1) {
    alert("至少需要保留一個使用者");
    return;
  }
  if (!confirm("確定要刪除此使用者嗎？此操作會刪除該使用者的所有學習記錄，無法復原。")) {
    return;
  }
  // 刪除使用者的所有資料
  const userKeys = [
    getUserStorageKey(userId, "wrong_questions"),
    getUserStorageKey(userId, "exam_stats"),
  ];
  userKeys.forEach((key) => localStorage.removeItem(key));

  // 從列表中移除
  state.users = state.users.filter((u) => u.id !== userId);
  saveUsers();

  // 如果刪除的是當前使用者，切換到第一個使用者
  if (state.currentUserId === userId) {
    if (state.users.length > 0) {
      switchUser(state.users[0].id);
    } else {
      state.currentUserId = null;
    }
  }
  renderUserList();
}

function switchUser(userId) {
  // 先保存當前使用者的資料
  saveCurrentUserData();

  // 切換使用者
  state.currentUserId = userId;
  saveCurrentUser();

  // 載入新使用者的資料
  loadCurrentUserData();

  // 更新顯示
  updateUserDisplay();
  renderUserList();
}

function updateUserDisplay() {
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (user) {
    currentUserDisplay.textContent = `使用者：${user.name}`;
  } else {
    currentUserDisplay.textContent = "使用者：—";
  }
}

function renderUserList() {
  if (!userList) return;
  const html = state.users
    .map((user) => {
      const isCurrent = user.id === state.currentUserId;
      return `
        <div class="user-item ${isCurrent ? "current" : ""}">
          <span class="user-name">${user.name}</span>
          <div class="user-item-actions">
            ${!isCurrent ? `<button class="btn tiny" onclick="switchUser('${user.id}')">切換</button>` : ""}
            ${state.users.length > 1 ? `<button class="btn tiny danger" onclick="deleteUser('${user.id}')">刪除</button>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
  userList.innerHTML = html || "<p>尚無使用者</p>";
}

function showUserPanel() {
  const overlay = $("user-modal-overlay");
  if (overlay) overlay.classList.remove("hidden");
  if (userPanel) userPanel.classList.remove("hidden");
  renderUserList();
  // 聚焦到輸入框
  if (newUserName) {
    setTimeout(() => newUserName.focus(), 100);
  }
}

function hideUserPanel() {
  const overlay = $("user-modal-overlay");
  if (overlay) overlay.classList.add("hidden");
  if (userPanel) userPanel.classList.add("hidden");
}

// localStorage 操作（改為支援多使用者）
function saveWrongQuestions() {
  if (!state.currentUserId) return;
  try {
    // 合併本輪錯題和歷史錯題，去重
    const allWrong = [...state.allWrongQuestions];
    state.wrongQuestions.forEach((q) => {
      if (!allWrong.find((x) => x.id === q.id)) {
        allWrong.push(q);
      }
    });
    const key = getUserStorageKey(state.currentUserId, "wrong_questions");
    localStorage.setItem(key, JSON.stringify(allWrong));
    state.allWrongQuestions = allWrong;
  } catch (e) {
    console.error("保存錯題失敗", e);
  }
}

function loadWrongQuestions() {
  if (!state.currentUserId) {
    state.allWrongQuestions = [];
    return;
  }
  try {
    const key = getUserStorageKey(state.currentUserId, "wrong_questions");
    const data = localStorage.getItem(key);
    if (data) {
      state.allWrongQuestions = JSON.parse(data);
    } else {
      state.allWrongQuestions = [];
    }
  } catch (e) {
    console.error("載入錯題失敗", e);
    state.allWrongQuestions = [];
  }
}

function saveExamStats() {
  if (!state.currentUserId) return;
  try {
    const stats = { ...state.cumulativeStats };
    // 合併本輪統計到累積統計
    Object.keys(state.perExamTotals).forEach((examId) => {
      if (!stats[examId]) {
        stats[examId] = { total: 0, correct: 0, wrong: 0 };
      }
      const total = state.perExamTotals[examId] || 0;
      const wrong = state.perExamWrongs[examId] || 0;
      const correct = total - wrong;
      stats[examId].total += total;
      stats[examId].correct += correct;
      stats[examId].wrong += wrong;
    });
    const key = getUserStorageKey(state.currentUserId, "exam_stats");
    localStorage.setItem(key, JSON.stringify(stats));
    state.cumulativeStats = stats;
  } catch (e) {
    console.error("保存統計失敗", e);
  }
}

function loadExamStats() {
  if (!state.currentUserId) {
    state.cumulativeStats = {};
    return;
  }
  try {
    const key = getUserStorageKey(state.currentUserId, "exam_stats");
    const data = localStorage.getItem(key);
    if (data) {
      state.cumulativeStats = JSON.parse(data);
    } else {
      state.cumulativeStats = {};
    }
  } catch (e) {
    console.error("載入統計失敗", e);
    state.cumulativeStats = {};
  }
}

function saveCurrentUserData() {
  // 保存當前使用者的所有資料
  saveWrongQuestions();
  saveExamStats();
  saveProgress();
}

function loadCurrentUserData() {
  // 載入當前使用者的所有資料
  loadWrongQuestions();
  loadExamStats();
  loadProgress();
}

// 保存答題進度
function saveProgress() {
  if (!state.currentUserId) return;
  if (!state.mode || !state.currentSet.length) return; // 沒有進行中的練習就不保存
  
  try {
    const progress = {
      mode: state.mode,
      currentIndex: state.currentIndex,
      questionIds: state.currentSet.map((q) => q.id), // 只保存題目 ID，節省空間
      wrongQuestionIds: state.wrongQuestions.map((q) => q.id),
      perExamTotals: state.perExamTotals,
      perExamWrongs: state.perExamWrongs,
      timestamp: Date.now(),
    };
    const key = getProgressStorageKey(state.currentUserId);
    localStorage.setItem(key, JSON.stringify(progress));
  } catch (e) {
    console.error("保存進度失敗", e);
  }
}

// 載入答題進度
function loadProgress() {
  if (!state.currentUserId) {
    state.currentSet = [];
    state.currentIndex = 0;
    state.mode = null;
    return;
  }
  
  try {
    const key = getProgressStorageKey(state.currentUserId);
    const data = localStorage.getItem(key);
    if (!data) {
      state.currentSet = [];
      state.currentIndex = 0;
      state.mode = null;
      return;
    }
    
    const progress = JSON.parse(data);
    
    // 檢查進度是否過期（超過 7 天就清除）
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (progress.timestamp && Date.now() - progress.timestamp > 7 * DAY_MS) {
      clearProgress();
      return;
    }
    
    // 根據題目 ID 重建題目集合
    const questionIds = progress.questionIds || [];
    if (questionIds.length === 0) {
      state.currentSet = [];
      state.currentIndex = 0;
      state.mode = null;
      return;
    }
    
    // 從 allQuestions 中找出對應的題目
    const restoredSet = questionIds
      .map((id) => state.allQuestions.find((q) => q.id === id))
      .filter(Boolean); // 過濾掉找不到的題目
    
    if (restoredSet.length === 0) {
      // 如果題庫已更新，找不到對應題目，清除進度
      clearProgress();
      return;
    }
    
    // 恢復狀態
    state.mode = progress.mode || null;
    state.currentSet = restoredSet;
    state.currentIndex = Math.min(progress.currentIndex || 0, restoredSet.length - 1);
    state.perExamTotals = progress.perExamTotals || {};
    state.perExamWrongs = progress.perExamWrongs || {};
    
    // 恢復本輪錯題
    const wrongQuestionIds = progress.wrongQuestionIds || [];
    state.wrongQuestions = wrongQuestionIds
      .map((id) => state.allQuestions.find((q) => q.id === id))
      .filter(Boolean);
    
    // 如果還有未完成的題目，自動恢復到答題畫面
    if (state.currentIndex < state.currentSet.length) {
      setModeLabel(getModeLabelText(state.mode));
      showQuestionPanel();
    } else {
      // 如果已經完成，顯示總結
      showSummary("本輪題目已完成！");
    }
  } catch (e) {
    console.error("載入進度失敗", e);
    state.currentSet = [];
    state.currentIndex = 0;
    state.mode = null;
  }
}

// 清除進度記錄
function clearProgress() {
  if (!state.currentUserId) return;
  try {
    const key = getProgressStorageKey(state.currentUserId);
    localStorage.removeItem(key);
  } catch (e) {
    console.error("清除進度失敗", e);
  }
}

// 取得模式標籤文字
function getModeLabelText(mode) {
  switch (mode) {
    case "all":
      return "全部練習";
    case "exam":
      return "單一回合";
    case "review":
      return "錯題複習";
    default:
      return "尚未選擇";
  }
}

// 匯出所有使用者資料（用於跨裝置同步）
function exportAllData() {
  try {
    if (!state.users || state.users.length === 0) {
      alert("目前沒有可匯出的使用者資料。");
      return;
    }

    const snapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      users: state.users,
      currentUserId: state.currentUserId,
      data: {}, // { [userId]: { wrongQuestions, examStats, progress } }
    };

    state.users.forEach((user) => {
      const userId = user.id;
      const wrongKey = getUserStorageKey(userId, "wrong_questions");
      const statsKey = getUserStorageKey(userId, "exam_stats");
      const progressKey = getProgressStorageKey(userId);

      let wrongQuestions = [];
      let examStats = {};
      let progress = null;

      try {
        const w = localStorage.getItem(wrongKey);
        if (w) wrongQuestions = JSON.parse(w);
      } catch {}

      try {
        const s = localStorage.getItem(statsKey);
        if (s) examStats = JSON.parse(s);
      } catch {}

      try {
        const p = localStorage.getItem(progressKey);
        if (p) progress = JSON.parse(p);
      } catch {}

      snapshot.data[userId] = {
        wrongQuestions,
        examStats,
        progress,
      };
    });

    const json = JSON.stringify(snapshot);

    // 優先嘗試寫入剪貼簿
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(json)
        .then(() => {
          alert("資料已複製到剪貼簿，可貼到手機或其他裝置。");
        })
        .catch(() => {
          // 失敗則用 prompt 讓使用者手動複製
          window.prompt("請手動複製以下資料，貼到手機或其他裝置：", json);
        });
    } else {
      window.prompt("請手動複製以下資料，貼到手機或其他裝置：", json);
    }
  } catch (e) {
    console.error("匯出資料失敗", e);
    alert("匯出資料時發生錯誤。");
  }
}

// 匯入所有使用者資料（用於跨裝置同步）
function importAllData() {
  try {
    const input = window.prompt("請貼上從其他裝置匯出的資料：");
    if (!input) return;

    let snapshot;
    try {
      snapshot = JSON.parse(input);
    } catch {
      alert("資料格式不正確，請確認是否完整貼上。");
      return;
    }

    if (!snapshot || !Array.isArray(snapshot.users) || !snapshot.data) {
      alert("資料內容不完整，無法匯入。");
      return;
    }

    if (
      !window.confirm(
        "匯入資料會覆蓋目前瀏覽器中的所有使用者與學習記錄，確定要繼續嗎？"
      )
    ) {
      return;
    }

    // 先清除舊的 toeic_* 資料
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith("toeic_user_") ||
        key === STORAGE_KEYS.USERS ||
        key === STORAGE_KEYS.CURRENT_USER
      ) {
        localStorage.removeItem(key);
      }
    });

    // 寫入新使用者列表
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(snapshot.users));

    const newCurrentUserId =
      snapshot.currentUserId && snapshot.users.find((u) => u.id === snapshot.currentUserId)
        ? snapshot.currentUserId
        : snapshot.users[0]?.id;

    if (newCurrentUserId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, newCurrentUserId);
    }

    // 寫入每個使用者的資料
    snapshot.users.forEach((user) => {
      const userId = user.id;
      const userData = snapshot.data[userId] || {};
      const wrongKey = getUserStorageKey(userId, "wrong_questions");
      const statsKey = getUserStorageKey(userId, "exam_stats");
      const progressKey = getProgressStorageKey(userId);

      localStorage.setItem(
        wrongKey,
        JSON.stringify(userData.wrongQuestions || [])
      );
      localStorage.setItem(
        statsKey,
        JSON.stringify(userData.examStats || {})
      );
      if (userData.progress) {
        localStorage.setItem(progressKey, JSON.stringify(userData.progress));
      }
    });

    // 重新載入到當前狀態
    loadUsers();
    loadCurrentUser();
    if (state.currentUserId) {
      loadCurrentUserData();
    }
    updateUserDisplay();
    renderUserList();
    resetPanels();

    alert("匯入完成！可以在任何裝置上用相同方式匯出/匯入來同步資料。");
  } catch (e) {
    console.error("匯入資料失敗", e);
    alert("匯入資料時發生錯誤。");
  }
}
// 取得模式標籤文字
function getModeLabelText(mode) {
  switch (mode) {
    case "all":
      return "全部練習";
    case "exam":
      return "單一回合";
    case "review":
      return "錯題複習";
    default:
      return "尚未選擇";
  }
}

function clearAllHistory() {
  if (!state.currentUserId) return;
  if (confirm("確定要清除當前使用者的所有答題記錄嗎？此操作無法復原。")) {
    const wrongKey = getUserStorageKey(state.currentUserId, "wrong_questions");
    const statsKey = getUserStorageKey(state.currentUserId, "exam_stats");
    const progressKey = getProgressStorageKey(state.currentUserId);
    localStorage.removeItem(wrongKey);
    localStorage.removeItem(statsKey);
    localStorage.removeItem(progressKey);
    state.allWrongQuestions = [];
    state.cumulativeStats = {};
    state.wrongQuestions = [];
    state.perExamTotals = {};
    state.perExamWrongs = {};
    state.currentSet = [];
    state.currentIndex = 0;
    state.mode = null;
    alert("已清除當前使用者的所有記錄。");
    // 如果正在查看分析畫面，重新渲染
    if (analysisPanel && !analysisPanel.classList.contains("hidden")) {
      renderAnalysis();
    }
    resetPanels();
  }
}

function setModeLabel(text) {
  statMode.textContent = `模式：${text}`;
}

function updateStats() {
  const total = state.currentSet.length;
  const index = state.currentIndex + 1;
  const correctCount =
    total - state.wrongQuestions.length >= 0
      ? total - state.wrongQuestions.length
      : 0;

  statProgress.textContent = `進度：${Math.min(index, total)} / ${total}`;
  statCorrect.textContent = `答對：${correctCount}`;
  statWrong.textContent = `答錯：${state.wrongQuestions.length}`;
}

function resetPanels() {
  if (questionPanel) questionPanel.classList.add("hidden");
  if (summaryPanel) summaryPanel.classList.add("hidden");
  if (examSelector) examSelector.classList.add("hidden");
  if (feedbackBox) feedbackBox.classList.add("hidden");
  if (analysisPanel) analysisPanel.classList.add("hidden");
  if (userPanel) userPanel.classList.add("hidden");
}

function startAllMode() {
  resetPanels();
  // 清除舊的進度記錄（開始新一輪）
  clearProgress();
  state.mode = "all";
  state.currentSet = [...state.allQuestions];
  state.currentIndex = 0;
  state.wrongQuestions = [];
  state.perExamTotals = {};
  state.perExamWrongs = {};
  setModeLabel("全部練習");
  showQuestionPanel();
  // 保存新進度
  saveProgress();
}

function startExamMode() {
  resetPanels();
  // 清除舊的進度記錄（開始新一輪）
  clearProgress();
  state.mode = "exam";
  setModeLabel("單一回合");
  if (examSelector) examSelector.classList.remove("hidden");
  state.perExamTotals = {};
  state.perExamWrongs = {};
  state.currentSet = [];
  state.currentIndex = 0;
  state.wrongQuestions = [];
}

function startReviewMode() {
  // 使用累積的所有錯題
  const allWrong = state.allWrongQuestions.length > 0 
    ? state.allWrongQuestions 
    : state.wrongQuestions;
  if (!allWrong.length) return;
  resetPanels();
  state.mode = "review";
  state.currentSet = [...allWrong];
  state.currentIndex = 0;
  state.perExamTotals = {};
  state.perExamWrongs = {};
  setModeLabel("錯題複習");
  showQuestionPanel();
}

function showQuestionPanel() {
  if (!state.currentSet.length) {
    showSummary("這個模式沒有題目。");
    return;
  }
  if (questionPanel) questionPanel.classList.remove("hidden");
  if (summaryPanel) summaryPanel.classList.add("hidden");
  renderCurrentQuestion();
}

function showSummary(msg) {
  if (questionPanel) questionPanel.classList.add("hidden");
  if (summaryPanel) summaryPanel.classList.remove("hidden");
  if (summaryText) summaryText.textContent = msg;

  const total = state.currentSet.length;
  const wrong = state.wrongQuestions.length;
  const correct = total - wrong;
  const percent =
    total > 0 ? Math.round((correct / total) * 100) : 0;

  // 保存本輪數據
  saveWrongQuestions();
  saveExamStats();

  // 基本統計
  const html = `
    <p>總題數：${total}</p>
    <p>答對：${correct}</p>
    <p>答錯：${wrong}</p>
    <p>正確率：${percent}%</p>
    <p class="summary-note">（本輪數據已自動保存）</p>
  `;

  summaryExtra.innerHTML = html;
}

function renderCurrentQuestion() {
  const q = state.currentSet[state.currentIndex];
  if (!q) {
    showSummary("本輪題目已完成！");
    return;
  }

  state.currentQuestionAnswered = false;
  if (feedbackBox) feedbackBox.classList.add("hidden");
  if (btnNext) btnNext.disabled = true;

  questionLabel.textContent = q.label || q.id || "Question";
  questionMeta.textContent = `Part ${q.part} | Exam ${q.examId} | ID: ${q.id}`;

  // 媒體
  if (q.image) {
    questionImage.src = `assets/${q.image}`;
    questionImage.classList.remove("hidden");
  } else {
    questionImage.classList.add("hidden");
  }

  questionText.textContent = q.text || "";

  // 選項
  optionsContainer.innerHTML = "";
  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.dataset.key = opt.key;
    btn.textContent = `${opt.key}. ${opt.text}`;
    btn.addEventListener("click", () => handleOptionClick(q, opt.key, btn));
    optionsContainer.appendChild(btn);
  });

  updateStats();
}

function handleOptionClick(q, chosenKey, btnElement) {
  if (state.currentQuestionAnswered) return;
  state.currentQuestionAnswered = true;

  // 鎖定所有選項按鈕
  const buttons = optionsContainer.querySelectorAll(".option-btn");
  buttons.forEach((b) => {
    b.classList.add("disabled");
    b.disabled = true;
  });

  const isCorrect = chosenKey === q.answer;
  const examIdKey = String(q.examId ?? "未知");

  // 本輪作答統計：每題只記一次
  state.perExamTotals[examIdKey] =
    (state.perExamTotals[examIdKey] || 0) + 1;

  if (!isCorrect) {
    btnElement.classList.add("wrong");
    // 記錄錯題（避免重複加入同一題）
    if (!state.wrongQuestions.find((x) => x.id === q.id)) {
      state.wrongQuestions.push(q);
      // 立即保存錯題到 localStorage
      saveWrongQuestions();
    }
    state.perExamWrongs[examIdKey] =
      (state.perExamWrongs[examIdKey] || 0) + 1;
  }
  
  // 每答一題就保存進度
  saveProgress();

  // 顯示正確答案按鈕樣式
  const correctBtn = Array.from(buttons).find(
    (b) => b.dataset.key === q.answer
  );
  if (correctBtn) {
    correctBtn.classList.add("correct");
  }

  // 不顯示文字回饋（已移除）
  // if (feedbackBox) feedbackBox.classList.remove("hidden");

  btnNext.disabled = false;
  updateStats();
}

function nextQuestion() {
  state.currentIndex += 1;
  // 保存進度
  saveProgress();
  if (state.currentIndex >= state.currentSet.length) {
    showSummary("本輪題目已完成！");
    // 完成後清除進度記錄
    clearProgress();
  } else {
    renderCurrentQuestion();
  }
}

// 答題分析畫面
function openAnalysisView() {
  resetPanels();
  if (analysisPanel) analysisPanel.classList.remove("hidden");
  renderAnalysis();
}

function backToSummary() {
  // 關閉分析視窗
  if (analysisPanel) analysisPanel.classList.add("hidden");

  // 如果還有尚未作答完的題目，回到題目視窗
  if (state.mode && state.currentSet.length > 0 && state.currentIndex < state.currentSet.length) {
    if (questionPanel) {
      questionPanel.classList.remove("hidden");
      // 重新渲染當前題目（避免使用者在分析頁面期間畫面被改動）
      renderCurrentQuestion();
    }
    return;
  }

  // 若當前輪已完成，回到總結畫面
  if (state.mode && state.currentSet.length > 0 && state.currentIndex >= state.currentSet.length) {
    if (summaryPanel) summaryPanel.classList.remove("hidden");
    return;
  }
}

function renderAnalysis() {
  // 使用累積的所有錯題（包含歷史記錄）
  const allWrong = [...state.allWrongQuestions];
  // 也加入本輪錯題（如果還沒保存）
  state.wrongQuestions.forEach((q) => {
    if (!allWrong.find((x) => x.id === q.id)) {
      allWrong.push(q);
    }
  });

  // 統計所有錯題，按回合分組
  const wrongByExam = {};
  allWrong.forEach((q) => {
    const examId = String(q.examId ?? "未知");
    if (!wrongByExam[examId]) {
      wrongByExam[examId] = [];
    }
    wrongByExam[examId].push(q);
  });

  // 使用累積統計（從 localStorage 載入的）
  const cumulativeStats = state.cumulativeStats;
  // 也合併本輪統計
  const mergedStats = { ...cumulativeStats };
  Object.keys(state.perExamTotals).forEach((examId) => {
    if (!mergedStats[examId]) {
      mergedStats[examId] = { total: 0, correct: 0, wrong: 0 };
    }
    const total = state.perExamTotals[examId] || 0;
    const wrong = state.perExamWrongs[examId] || 0;
    const correct = total - wrong;
    mergedStats[examId].total += total;
    mergedStats[examId].correct += correct;
    mergedStats[examId].wrong += wrong;
  });

  // 取得所有有錯題或作答紀錄的回合
  const allExamIds = Array.from(
    new Set([
      ...Object.keys(wrongByExam),
      ...Object.keys(mergedStats),
    ])
  );

  if (!allExamIds.length && allWrong.length === 0) {
    analysisContent.innerHTML = "<p>目前還沒有錯題記錄。先做幾題再來查看分析！</p>";
    btnPracticeAllWrong.disabled = true;
    return;
  }

  const rows = allExamIds
    .map((id) => {
      const wrongList = wrongByExam[id] || [];
      const stats = mergedStats[id] || { total: 0, correct: 0, wrong: 0 };
      const percent =
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      return {
        examId: id,
        total: stats.total || wrongList.length,
        wrong: stats.wrong || wrongList.length,
        correct: stats.correct,
        percent,
        hasWrong: wrongList.length > 0,
      };
    })
    .sort((a, b) => {
      // 先按數字排序，未知放最後
      if (a.examId === "未知") return 1;
      if (b.examId === "未知") return -1;
      return Number(a.examId) - Number(b.examId);
    });

  const tableHtml = `
    <table class="summary-table">
      <thead>
        <tr>
          <th>回合 Exam</th>
          <th>題數</th>
          <th>答對</th>
          <th>答錯</th>
          <th>正確率</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr>
            <td>Exam ${row.examId}</td>
            <td>${row.total}</td>
            <td>${row.correct}</td>
            <td>${row.wrong}</td>
            <td>${row.percent}%</td>
            <td>
              <button class="btn small practice-wrong" data-exam="${row.examId}" ${!row.hasWrong ? 'disabled' : ''}>
                練習錯題
              </button>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  analysisContent.innerHTML = tableHtml;
  btnPracticeAllWrong.disabled = allWrong.length === 0;
}

function practiceWrongByExam(examId) {
  // 使用累積的所有錯題
  const allWrong = [...state.allWrongQuestions];
  state.wrongQuestions.forEach((q) => {
    if (!allWrong.find((x) => x.id === q.id)) {
      allWrong.push(q);
    }
  });
  const list = allWrong.filter(
    (q) => String(q.examId) === String(examId)
  );
  if (!list.length) {
    alert(`回合 Exam ${examId} 目前沒有錯題可以練習。`);
    return;
  }

  resetPanels();
  // 清除舊的進度記錄（開始新一輪）
  clearProgress();
  state.mode = "review";
  state.currentSet = [...list];
  state.currentIndex = 0;
  state.currentQuestionAnswered = false;
  state.wrongQuestions = [];
  state.perExamTotals = {};
  state.perExamWrongs = {};
  setModeLabel(`錯題複習 - Exam ${examId}`);
  showQuestionPanel();
  // 保存新進度
  saveProgress();
}

function practiceAllWrongs() {
  // 使用累積的所有錯題
  const allWrong = [...state.allWrongQuestions];
  state.wrongQuestions.forEach((q) => {
    if (!allWrong.find((x) => x.id === q.id)) {
      allWrong.push(q);
    }
  });
  if (!allWrong.length) {
    alert("目前沒有錯題可以練習。");
    return;
  }
  resetPanels();
  // 清除舊的進度記錄（開始新一輪）
  clearProgress();
  state.mode = "review";
  state.currentSet = [...allWrong];
  state.currentIndex = 0;
  state.currentQuestionAnswered = false;
  state.wrongQuestions = [];
  state.perExamTotals = {};
  state.perExamWrongs = {};
  setModeLabel("全部錯題複習");
  showQuestionPanel();
  // 保存新進度
  saveProgress();
}

// 初始化：讀取 web_questions.json
async function init() {
  // 先載入使用者系統
  loadUsers();
  loadCurrentUser();
  if (state.currentUserId) {
    // 先載入錯題和統計（不載入進度，因為需要先載入題庫）
    loadWrongQuestions();
    loadExamStats();
  }
  updateUserDisplay();

  try {
    const res = await fetch("web_questions.json");
    const data = await res.json();
    state.allQuestions = Array.isArray(data) ? data : [];

    // 取得所有 examId，填入下拉選單
    const examIds = Array.from(
      new Set(state.allQuestions.map((q) => q.examId).filter(Boolean))
    ).sort((a, b) => Number(a) - Number(b));

    if (examSelect) {
      examSelect.innerHTML = "";
      examIds.forEach((id) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = `Exam ${id}`;
        examSelect.appendChild(opt);
      });
    }

    // 題庫載入完成後，再載入進度（需要題庫才能恢復題目）
    if (state.currentUserId) {
      loadProgress();
    } else {
      setModeLabel("尚未選擇");
    }
  } catch (e) {
    console.error("載入題庫失敗", e);
    setModeLabel("載入題庫失敗");
  }
}

// 綁定所有事件監聽器
function bindEvents() {
  // 模式按鈕
  if (modeAllBtn) {
    modeAllBtn.addEventListener("click", () => {
      startAllMode();
    });
  }

  if (modeExamBtn) {
    modeExamBtn.addEventListener("click", () => {
      startExamMode();
    });
  }

  if (modeReviewBtn) {
    modeReviewBtn.addEventListener("click", () => {
      openAnalysisView();
    });
  }

  // 總結和分析按鈕
  if (btnOpenAnalysis) {
    btnOpenAnalysis.addEventListener("click", () => {
      openAnalysisView();
    });
  }

  if (btnAnalysisBack) {
    btnAnalysisBack.addEventListener("click", () => {
      backToSummary();
    });
  }

  if (btnPracticeAllWrong) {
    btnPracticeAllWrong.addEventListener("click", () => {
      practiceAllWrongs();
    });
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener("click", () => {
      clearAllHistory();
    });
  }

  // 答題分析表格中的按鈕（事件委派）
  if (analysisContent) {
    analysisContent.addEventListener("click", (e) => {
      const target = e.target;
      if (target instanceof HTMLElement && target.classList.contains("practice-wrong")) {
        const examId = target.dataset.exam;
        if (examId) {
          practiceWrongByExam(examId);
        }
      }
    });
  }

  // 回合選擇
  if (startExamBtn) {
    startExamBtn.addEventListener("click", () => {
      const selectedExamId = examSelect.value;
      if (!selectedExamId) return;
      state.currentSet = state.allQuestions.filter(
        (q) => String(q.examId) === String(selectedExamId)
      );
      state.currentIndex = 0;
      state.wrongQuestions = [];
      if (examSelector) examSelector.classList.add("hidden");
      showQuestionPanel();
    });
  }

  // 下一題按鈕
  if (btnNext) {
    btnNext.addEventListener("click", () => {
      nextQuestion();
    });
  }

  // 使用者相關事件
  if (btnUserMenu) {
    btnUserMenu.addEventListener("click", () => {
      showUserPanel();
    });
  }

  if (btnUserClose) {
    btnUserClose.addEventListener("click", () => {
      hideUserPanel();
    });
  }

  // 匯出 / 匯入資料
  if (btnExportData) {
    btnExportData.addEventListener("click", () => {
      exportAllData();
    });
  }

  if (btnImportData) {
    btnImportData.addEventListener("click", () => {
      importAllData();
    });
  }

  // 確定按鈕
  const btnUserOk = $("btn-user-ok");
  if (btnUserOk) {
    btnUserOk.addEventListener("click", () => {
      hideUserPanel();
    });
  }

  // 點擊背景遮罩關閉彈窗
  const modalOverlay = $("user-modal-overlay");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        hideUserPanel();
      }
    });
  }

  // ESC 鍵關閉彈窗
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && userPanel && !userPanel.classList.contains("hidden")) {
      hideUserPanel();
    }
  });

  if (btnAddUser) {
    btnAddUser.addEventListener("click", () => {
      const name = newUserName.value.trim();
      if (name) {
        addUser(name);
        newUserName.value = "";
      }
    });
  }

  if (newUserName) {
    newUserName.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        btnAddUser.click();
      }
    });
  }

  // 將函數暴露到全域，讓 HTML 中的 onclick 可以呼叫
  window.switchUser = switchUser;
  window.deleteUser = deleteUser;
}

// 初始化
window.addEventListener("load", () => {
  init();
  bindEvents();
});


