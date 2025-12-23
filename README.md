# TOEIC 練習系統

一個具有復古 Windows 95 風格的 TOEIC 練習網站，支援多使用者、答題分析、進度記錄等功能。

## 功能特色

- 🎯 多種練習模式：全部練習、單一回合、錯題複習
- 📊 答題分析：查看各回合答題統計與正確率
- 👤 多使用者支援：獨立學習記錄
- 💾 進度保存：自動記錄答題進度，關閉瀏覽器後可繼續
- 📱 響應式設計：適配電腦和手機端
- 💾 資料匯出/匯入：可在不同裝置間同步學習記錄
- 🎨 復古 UI：Windows 95 風格介面

## 如何使用

### 線上使用

網站已部署到 GitHub Pages，可以直接訪問使用。

### 本地運行

1. 克隆此倉庫：
```bash
git clone https://github.com/wall4oppy/TOEIC.git
cd TOEIC
```

2. 使用本地伺服器開啟（建議使用 Python）：
```bash
# Python 3
python -m http.server 8000

# 或使用其他本地伺服器
```

3. 在瀏覽器中開啟 `http://localhost:8000`

## 啟用 GitHub Pages

1. 前往 GitHub 倉庫頁面：https://github.com/wall4oppy/TOEIC
2. 點擊 **Settings**（設定）
3. 在左側選單中找到 **Pages**
4. 在 **Source** 選擇 **Deploy from a branch**
5. 選擇分支 **main**，資料夾選擇 **/ (root)**
6. 點擊 **Save**
7. 等待幾分鐘後，網站會發布到：`https://wall4oppy.github.io/TOEIC/`

## 專案結構

```
TOEIC/
├── index.html          # 主頁面
├── main.js            # 主要邏輯
├── style.css          # 樣式檔案
├── web_questions.json # 題庫資料
├── assets/            # 題目圖片
├── convert_to_web_questions.py  # 題庫轉換腳本
└── README.md          # 說明文件
```

## 技術說明

- 純前端實現，使用 localStorage 儲存資料
- 無需後端伺服器，可直接在 GitHub Pages 上運行
- 支援資料匯出/匯入功能，可在不同裝置間同步

## 授權

此專案為個人學習使用。

