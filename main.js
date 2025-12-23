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
const btnJumpPart = $("btn-jump-part");
const partSelector = $("part-selector");
const partSelect = $("part-select");
const startPartBtn = $("start-part");

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

// 顯示刪除確認彈窗
function showDeleteConfirm(userId) {
  if (state.users.length <= 1) {
    alert("至少需要保留一個使用者");
    return;
  }
  
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  
  // 先關閉使用者管理彈窗，避免重疊
  hideUserPanel();
  
  const deleteOverlay = $("delete-confirm-modal-overlay");
  const deletePanel = $("delete-confirm-panel");
  const deleteMessage = $("delete-confirm-message");
  
  if (deleteMessage) {
    deleteMessage.textContent = `確定要刪除使用者「${user.name}」嗎？此操作會刪除該使用者的所有學習記錄，無法復原。`;
  }
  
  // 儲存要刪除的使用者 ID
  if (deletePanel) {
    deletePanel.dataset.userIdToDelete = userId;
  }
  
  if (deleteOverlay) deleteOverlay.classList.remove("hidden");
  if (deletePanel) deletePanel.classList.remove("hidden");
}

// 隱藏刪除確認彈窗
function hideDeleteConfirm() {
  const deleteOverlay = $("delete-confirm-modal-overlay");
  const deletePanel = $("delete-confirm-panel");
  if (deleteOverlay) deleteOverlay.classList.add("hidden");
  if (deletePanel) deletePanel.classList.add("hidden");
}

// 顯示訊息彈窗（通用）
function showMessage(title, text) {
  // 先關閉使用者管理彈窗，避免重疊
  hideUserPanel();
  
  const messageOverlay = $("message-modal-overlay");
  const messagePanel = $("message-panel");
  const messageTitle = $("message-title");
  const messageText = $("message-text");
  
  if (messageTitle) messageTitle.textContent = title || "訊息";
  if (messageText) messageText.textContent = text || "";
  
  if (messageOverlay) messageOverlay.classList.remove("hidden");
  if (messagePanel) messagePanel.classList.remove("hidden");
}

// 隱藏訊息彈窗
function hideMessage() {
  const messageOverlay = $("message-modal-overlay");
  const messagePanel = $("message-panel");
  if (messageOverlay) messageOverlay.classList.add("hidden");
  if (messagePanel) messagePanel.classList.add("hidden");
}

// 執行刪除使用者
function deleteUser(userId) {
  // 刪除使用者的所有資料
  const userKeys = [
    getUserStorageKey(userId, "wrong_questions"),
    getUserStorageKey(userId, "exam_stats"),
  ];
  const progressKey = getProgressStorageKey(userId);
  userKeys.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(progressKey);

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
  hideDeleteConfirm();
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
    currentUserDisplay.textContent = `使用者: ${user.name}`;
  } else {
    currentUserDisplay.textContent = "使用者: —";
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
            ${state.users.length > 1 ? `<button class="btn tiny danger" onclick="showDeleteConfirm('${user.id}')">刪除</button>` : ""}
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
function showExportPanel() {
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

    // 顯示彈窗並填入資料
    const exportOverlay = $("export-modal-overlay");
    const exportPanel = $("export-panel");
    const exportTextOutput = $("export-text-output");
    
    if (exportOverlay) exportOverlay.classList.remove("hidden");
    if (exportPanel) exportPanel.classList.remove("hidden");
    if (exportTextOutput) {
      exportTextOutput.value = json;
      // 自動選取所有文字，方便複製
      setTimeout(() => {
        exportTextOutput.select();
      }, 100);
    }
  } catch (e) {
    console.error("匯出資料失敗", e);
    alert("匯出資料時發生錯誤。");
  }
}

function hideExportPanel() {
  const exportOverlay = $("export-modal-overlay");
  const exportPanel = $("export-panel");
  if (exportOverlay) exportOverlay.classList.add("hidden");
  if (exportPanel) exportPanel.classList.add("hidden");
}

function copyExportData() {
  const exportTextOutput = $("export-text-output");
  if (!exportTextOutput) return;
  
  const text = exportTextOutput.value;
  if (!text) {
    showMessage("錯誤", "沒有可複製的資料。");
    return;
  }

  // 優先嘗試使用剪貼簿 API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showMessage("複製成功", "資料已複製到剪貼簿！");
      })
      .catch(() => {
        // 降級方案：使用傳統方法
        exportTextOutput.select();
        try {
          document.execCommand("copy");
          showMessage("複製成功", "資料已複製到剪貼簿！");
        } catch {
          showMessage("複製失敗", "無法自動複製，請手動選取文字並複製（Ctrl+C）。");
        }
      });
  } else {
    // 降級方案
    exportTextOutput.select();
    try {
      document.execCommand("copy");
      showMessage("複製成功", "資料已複製到剪貼簿！");
    } catch {
      showMessage("複製失敗", "無法自動複製，請手動選取文字並複製（Ctrl+C）。");
    }
  }
}

function downloadExportData() {
  const exportTextOutput = $("export-text-output");
  if (!exportTextOutput) return;
  
  const text = exportTextOutput.value;
  if (!text) {
    showMessage("錯誤", "沒有可下載的資料。");
    return;
  }

  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toeic_data_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage("下載完成", "檔案下載成功！");
  } catch (e) {
    console.error("下載失敗", e);
    showMessage("錯誤", "下載檔案時發生錯誤。");
  }
}

// 匯入所有使用者資料（用於跨裝置同步）
function showImportPanel() {
  // 先關閉使用者管理彈窗，避免重疊
  hideUserPanel();
  
  const importOverlay = $("import-modal-overlay");
  const importPanel = $("import-panel");
  const importTextInput = $("import-text-input");
  const importFileInput = $("import-file-input");
  const importFileName = $("import-file-name");
  
  if (importOverlay) importOverlay.classList.remove("hidden");
  if (importPanel) importPanel.classList.remove("hidden");
  if (importTextInput) importTextInput.value = "";
  if (importFileInput) importFileInput.value = "";
  if (importFileName) importFileName.textContent = "";
  
  // 聚焦到文字輸入框
  if (importTextInput) {
    setTimeout(() => importTextInput.focus(), 100);
  }
}

function hideImportPanel() {
  const importOverlay = $("import-modal-overlay");
  const importPanel = $("import-panel");
  if (importOverlay) importOverlay.classList.add("hidden");
  if (importPanel) importPanel.classList.add("hidden");
}

// 顯示匯入確認彈窗
function showImportConfirm(inputText) {
  // 先關閉匯入彈窗
  hideImportPanel();
  
  const importConfirmOverlay = $("import-confirm-modal-overlay");
  const importConfirmPanel = $("import-confirm-panel");
  
  // 儲存要匯入的資料
  if (importConfirmPanel) {
    importConfirmPanel.dataset.importData = inputText;
  }
  
  if (importConfirmOverlay) importConfirmOverlay.classList.remove("hidden");
  if (importConfirmPanel) importConfirmPanel.classList.remove("hidden");
}

// 隱藏匯入確認彈窗
function hideImportConfirm() {
  const importConfirmOverlay = $("import-confirm-modal-overlay");
  const importConfirmPanel = $("import-confirm-panel");
  if (importConfirmOverlay) importConfirmOverlay.classList.add("hidden");
  if (importConfirmPanel) importConfirmPanel.classList.add("hidden");
}

// 執行匯入資料
function importAllData(inputText) {
  try {
    if (!inputText || !inputText.trim()) {
      alert("請輸入或選擇要匯入的資料。");
      return;
    }

    let snapshot;
    try {
      snapshot = JSON.parse(inputText);
    } catch {
      alert("資料格式不正確，請確認是否完整貼上。");
      return;
    }

    if (!snapshot || !Array.isArray(snapshot.users) || !snapshot.data) {
      alert("資料內容不完整，無法匯入。");
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

    // 關閉匯入彈窗，先不顯示使用者管理彈窗
    hideImportPanel();

    // 顯示成功訊息（訊息彈窗會自動顯示在最上層）
    showMessage("匯入完成", "匯入完成！可以在任何裝置上用相同方式匯出/匯入來同步資料。");
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
  
  // 關閉所有 modal 彈窗和遮罩
  const summaryOverlay = $("summary-modal-overlay");
  const userOverlay = $("user-modal-overlay");
  const importOverlay = $("import-modal-overlay");
  
  if (summaryPanel) summaryPanel.classList.add("hidden");
  if (summaryOverlay) summaryOverlay.classList.add("hidden");
  if (analysisPanel) analysisPanel.classList.add("hidden");
  if (userPanel) userPanel.classList.add("hidden");
  if (userOverlay) userOverlay.classList.add("hidden");
  hideImportPanel();
  hideExportPanel();
  hideDeleteConfirm();
  hideImportConfirm();
  hideMessage();
  
  if (examSelector) examSelector.classList.add("hidden");
  if (feedbackBox) feedbackBox.classList.add("hidden");
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
  
  // 顯示快速跳轉Part按鈕
  if (btnJumpPart) btnJumpPart.classList.remove("hidden");
  // 隱藏Part選擇器
  if (partSelector) partSelector.classList.add("hidden");
  
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
  
  // 顯示快速跳轉Part按鈕
  if (btnJumpPart) btnJumpPart.classList.remove("hidden");
  // 隱藏Part選擇器
  if (partSelector) partSelector.classList.add("hidden");
  
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
  
  // 隱藏總結彈窗和遮罩
  const summaryOverlay = $("summary-modal-overlay");
  if (summaryOverlay) summaryOverlay.classList.add("hidden");
  if (summaryPanel) summaryPanel.classList.add("hidden");
  
  renderCurrentQuestion();
}

function showSummary(msg) {
  if (questionPanel) questionPanel.classList.add("hidden");
  
  const summaryOverlay = $("summary-modal-overlay");
  if (summaryOverlay) summaryOverlay.classList.remove("hidden");
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
    const summaryOverlay = $("summary-modal-overlay");
    if (summaryOverlay) summaryOverlay.classList.remove("hidden");
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

    // 取得所有 part，填入Part下拉選單
    const parts = Array.from(
      new Set(state.allQuestions.map((q) => q.part).filter(Boolean))
    ).sort((a, b) => Number(a) - Number(b));

    if (partSelect) {
      partSelect.innerHTML = "";
      parts.forEach((part) => {
        const opt = document.createElement("option");
        opt.value = part;
        opt.textContent = `Part ${part}`;
        partSelect.appendChild(opt);
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
      // 顯示快速跳轉Part按鈕
      if (btnJumpPart) btnJumpPart.classList.remove("hidden");
      showQuestionPanel();
    });
  }

  // 快速跳轉Part按鈕
  if (btnJumpPart) {
    btnJumpPart.addEventListener("click", () => {
      if (partSelector) partSelector.classList.remove("hidden");
    });
  }

  // Part選擇
  if (startPartBtn) {
    startPartBtn.addEventListener("click", () => {
      const selectedPart = partSelect.value;
      if (!selectedPart) return;
      
      resetPanels();
      clearProgress();
      
      let filteredQuestions = [];
      
      if (state.mode === "all") {
        // 全部練習模式：顯示所有回數中該Part的題目
        filteredQuestions = state.allQuestions.filter(
          (q) => String(q.part) === String(selectedPart)
        );
        setModeLabel(`全部練習 - Part ${selectedPart}`);
      } else if (state.mode === "exam") {
        // 單一回合模式：顯示該單一回數中該Part的題目
        const selectedExamId = examSelect.value;
        if (!selectedExamId) {
          showMessage("錯誤", "請先選擇回合。");
          return;
        }
        filteredQuestions = state.allQuestions.filter(
          (q) => String(q.examId) === String(selectedExamId) && String(q.part) === String(selectedPart)
        );
        setModeLabel(`單一回合 - Exam ${selectedExamId} - Part ${selectedPart}`);
      }
      
      if (filteredQuestions.length === 0) {
        showMessage("錯誤", "找不到符合條件的題目。");
        return;
      }
      
      state.currentSet = filteredQuestions;
      state.currentIndex = 0;
      state.wrongQuestions = [];
      state.perExamTotals = {};
      state.perExamWrongs = {};
      
      if (partSelector) partSelector.classList.add("hidden");
      if (examSelector) examSelector.classList.add("hidden");
      if (btnJumpPart) btnJumpPart.classList.remove("hidden");
      
      showQuestionPanel();
      saveProgress();
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
      showExportPanel();
    });
  }

  // 匯出彈窗相關事件
  const btnExportCopy = $("btn-export-copy");
  const btnExportDownload = $("btn-export-download");
  const btnExportClose = $("btn-export-close");
  const btnExportCloseFooter = $("btn-export-close-footer");
  const exportOverlay = $("export-modal-overlay");

  if (btnExportCopy) {
    btnExportCopy.addEventListener("click", () => {
      copyExportData();
    });
  }

  if (btnExportDownload) {
    btnExportDownload.addEventListener("click", () => {
      downloadExportData();
    });
  }

  if (btnExportClose) {
    btnExportClose.addEventListener("click", () => {
      hideExportPanel();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  if (btnExportCloseFooter) {
    btnExportCloseFooter.addEventListener("click", () => {
      hideExportPanel();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  // 點擊背景遮罩關閉匯出彈窗
  if (exportOverlay) {
    exportOverlay.addEventListener("click", (e) => {
      if (e.target === exportOverlay) {
        hideExportPanel();
        // 關閉後重新顯示使用者管理彈窗
        showUserPanel();
      }
    });
  }

  if (btnImportData) {
    btnImportData.addEventListener("click", () => {
      showImportPanel();
    });
  }

  // 匯入彈窗相關事件
  const importTextInput = $("import-text-input");
  const importFileInput = $("import-file-input");
  const importFileName = $("import-file-name");
  const btnImportConfirm = $("btn-import-confirm");
  const btnImportCancel = $("btn-import-cancel");
  const btnImportClose = $("btn-import-close");
  const importOverlay = $("import-modal-overlay");

  // 檔案選擇事件
  if (importFileInput) {
    importFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        if (importFileName) {
          importFileName.textContent = file.name;
        }
        // 讀取檔案內容
        const reader = new FileReader();
        reader.onload = (event) => {
          if (importTextInput) {
            importTextInput.value = event.target.result;
          }
        };
        reader.onerror = () => {
          alert("讀取檔案失敗，請確認檔案格式是否正確。");
        };
        reader.readAsText(file, "UTF-8");
      }
    });
  }

  // 確定匯入按鈕
  if (btnImportConfirm) {
    btnImportConfirm.addEventListener("click", () => {
      const inputText = importTextInput ? importTextInput.value.trim() : "";
      importAllData(inputText);
    });
  }

  // 取消按鈕
  if (btnImportCancel) {
    btnImportCancel.addEventListener("click", () => {
      hideImportPanel();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  // 關閉按鈕
  if (btnImportClose) {
    btnImportClose.addEventListener("click", () => {
      hideImportPanel();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  // 點擊背景遮罩關閉匯入彈窗
  if (importOverlay) {
    importOverlay.addEventListener("click", (e) => {
      if (e.target === importOverlay) {
        hideImportPanel();
        // 關閉後重新顯示使用者管理彈窗
        showUserPanel();
      }
    });
  }

  // 文字輸入框按 Enter 確認（Ctrl+Enter）
  if (importTextInput) {
    importTextInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        btnImportConfirm?.click();
      }
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

  // 總結彈窗關閉按鈕
  const btnSummaryClose = $("btn-summary-close");
  if (btnSummaryClose) {
    btnSummaryClose.addEventListener("click", () => {
      const summaryOverlay = $("summary-modal-overlay");
      if (summaryOverlay) summaryOverlay.classList.add("hidden");
      if (summaryPanel) summaryPanel.classList.add("hidden");
      // 如果還有題目未完成，回到題目畫面
      if (state.mode && state.currentSet.length > 0 && state.currentIndex < state.currentSet.length) {
        if (questionPanel) {
          questionPanel.classList.remove("hidden");
          renderCurrentQuestion();
        }
      }
    });
  }

  // 點擊背景遮罩關閉總結彈窗
  const summaryOverlay = $("summary-modal-overlay");
  if (summaryOverlay) {
    summaryOverlay.addEventListener("click", (e) => {
      if (e.target === summaryOverlay) {
        btnSummaryClose?.click();
      }
    });
  }

  // 訊息彈窗相關事件
  const messagePanel = $("message-panel");
  const btnMessageOk = $("btn-message-ok");
  const btnMessageClose = $("btn-message-close");
  const messageOverlay = $("message-modal-overlay");

  if (btnMessageOk) {
    btnMessageOk.addEventListener("click", () => {
      hideMessage();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  if (btnMessageClose) {
    btnMessageClose.addEventListener("click", () => {
      hideMessage();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  // 點擊背景遮罩關閉訊息彈窗
  if (messageOverlay) {
    messageOverlay.addEventListener("click", (e) => {
      if (e.target === messageOverlay) {
        hideMessage();
        // 關閉後重新顯示使用者管理彈窗
        showUserPanel();
      }
    });
  }

  // 匯入確認彈窗相關事件
  const importConfirmPanel = $("import-confirm-panel");
  const btnImportConfirmOk = $("btn-import-confirm-ok");
  const btnImportConfirmCancel = $("btn-import-confirm-cancel");
  const btnImportConfirmClose = $("btn-import-confirm-close");
  const importConfirmOverlay = $("import-confirm-modal-overlay");

  if (btnImportConfirmOk) {
    btnImportConfirmOk.addEventListener("click", () => {
      const importData = importConfirmPanel?.dataset.importData;
      if (importData) {
        hideImportConfirm();
        importAllData(importData);
      }
    });
  }

  if (btnImportConfirmCancel) {
    btnImportConfirmCancel.addEventListener("click", () => {
      hideImportConfirm();
      // 關閉後重新顯示匯入彈窗
      showImportPanel();
    });
  }

  if (btnImportConfirmClose) {
    btnImportConfirmClose.addEventListener("click", () => {
      hideImportConfirm();
      // 關閉後重新顯示匯入彈窗
      showImportPanel();
    });
  }

  // 點擊背景遮罩關閉匯入確認彈窗
  if (importConfirmOverlay) {
    importConfirmOverlay.addEventListener("click", (e) => {
      if (e.target === importConfirmOverlay) {
        hideImportConfirm();
        // 關閉後重新顯示匯入彈窗
        showImportPanel();
      }
    });
  }

  // 刪除確認彈窗相關事件
  const deleteConfirmPanel = $("delete-confirm-panel");
  const btnDeleteConfirmOk = $("btn-delete-confirm-ok");
  const btnDeleteConfirmCancel = $("btn-delete-confirm-cancel");
  const btnDeleteConfirmClose = $("btn-delete-confirm-close");
  const deleteConfirmOverlay = $("delete-confirm-modal-overlay");

  if (btnDeleteConfirmOk) {
    btnDeleteConfirmOk.addEventListener("click", () => {
      const userIdToDelete = deleteConfirmPanel?.dataset.userIdToDelete;
      if (userIdToDelete) {
        deleteUser(userIdToDelete);
        // 刪除後自動顯示使用者管理彈窗（已在 deleteUser 中處理）
      }
    });
  }

  if (btnDeleteConfirmCancel) {
    btnDeleteConfirmCancel.addEventListener("click", () => {
      hideDeleteConfirm();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  if (btnDeleteConfirmClose) {
    btnDeleteConfirmClose.addEventListener("click", () => {
      hideDeleteConfirm();
      // 關閉後重新顯示使用者管理彈窗
      showUserPanel();
    });
  }

  // 點擊背景遮罩關閉刪除確認彈窗
  if (deleteConfirmOverlay) {
    deleteConfirmOverlay.addEventListener("click", (e) => {
      if (e.target === deleteConfirmOverlay) {
        hideDeleteConfirm();
        // 關閉後重新顯示使用者管理彈窗
        showUserPanel();
      }
    });
  }

  // ESC 鍵關閉彈窗（支援所有彈窗，優先關閉最上層的彈窗）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const importPanel = $("import-panel");
      const exportPanel = $("export-panel");
      const importConfirmPanel = $("import-confirm-panel");
      const deleteConfirmPanel = $("delete-confirm-panel");
      const messagePanel = $("message-panel");
      const summaryPanel = $("summary-panel");
      const userPanel = $("user-panel");
      
      // 按 z-index 從高到低關閉（功能彈窗 > 基礎彈窗）
      if (messagePanel && !messagePanel.classList.contains("hidden")) {
        hideMessage();
        // 關閉後重新顯示使用者管理彈窗
        showUserPanel();
      } else if (importConfirmPanel && !importConfirmPanel.classList.contains("hidden")) {
        hideImportConfirm();
        // 關閉後重新顯示匯入彈窗
        showImportPanel();
      } else if (importPanel && !importPanel.classList.contains("hidden")) {
        hideImportPanel();
        // 如果是從使用者管理彈窗打開的，關閉後重新顯示使用者管理彈窗
        showUserPanel();
      } else if (exportPanel && !exportPanel.classList.contains("hidden")) {
        hideExportPanel();
        // 如果是從使用者管理彈窗打開的，關閉後重新顯示使用者管理彈窗
        showUserPanel();
      } else if (deleteConfirmPanel && !deleteConfirmPanel.classList.contains("hidden")) {
        hideDeleteConfirm();
        // 如果是從使用者管理彈窗打開的，關閉後重新顯示使用者管理彈窗
        showUserPanel();
      } else if (summaryPanel && !summaryPanel.classList.contains("hidden")) {
        btnSummaryClose?.click();
      } else if (userPanel && !userPanel.classList.contains("hidden")) {
        hideUserPanel();
      }
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
  window.showDeleteConfirm = showDeleteConfirm;
}

// 初始化
window.addEventListener("load", () => {
  init();
  bindEvents();
});


