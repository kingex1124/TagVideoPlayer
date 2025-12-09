# TagVideoPlayer - 跨平台影片播放器應用

## 項目概述

TagVideoPlayer 是一個使用 Electron 構建的跨平台影片播放器應用，支援 Windows 和 macOS。該應用專為影片內容標註而設計，允許用戶在播放影片時創建時間戳記標籤，並自動保存和重新加載這些註記。

## 核心功能

### 🎥 影片文件處理
- 支援拖放影片文件到應用窗口
- 自動播放功能
- 支援常見影片格式（mp4, mkv, avi, mov, flv, wmv, webm）

### 🏷️ 時間線標籤系統
- 在播放期間暫停並創建註記
- 每個標籤包含：
  - `time`: 時間戳（秒）
  - `title`: 標籤名稱
  - `description`: 詳細描述

### 💾 持久化與自動加載
- 標籤自動保存至 JSON 文件（格式：`{視頻名稱}.json`）
- 打開相同影片時自動加載現有標籤
- 實時更新標籤列表

### ⏱️ 交互播放
- 點擊標籤快速跳轉到對應時間戳
- 平滑尋求和位置更新
- 標籤快速導航

## 項目結構

```
TagVideoPlayer/
├── main.js                          # 主進程入口
├── package.json                     # 項目配置
├── .github/
│   └── copilot-instructions.md     # 開發指南
├── src/
│   ├── preload.js                  # 預加載腳本（IPC 通信）
│   ├── main-process/
│   │   └── window-manager.js       # 窗口和 IPC 管理
│   ├── renderer/
│   │   ├── index.html              # 主窗口 HTML
│   │   ├── styles.css              # 樣式文件
│   │   └── app.js                  # 應用邏輯
│   └── utils/
│       ├── file-utils.js           # 文件操作工具
│       └── json-handler.js         # JSON 處理工具
├── assets/                          # 圖標和資源
└── .gitignore
```

## 技術棧

- **Electron**: 跨平台桌面應用框架
- **Commander.js**: 命令行參數解析
- **Electron Builder**: 應用打包和分發
- **HTML5 Video API**: 影片播放控制
- **IPC**: 主進程和渲染進程通信

## 快速開始

### 安裝依賴
```bash
npm install
```

### 開發模式運行
```bash
npm start
```

### 構建平台特定安裝程序

#### Windows
```bash
npm run build-win
```

#### macOS
```bash
npm run build-mac
```

#### 所有平台
```bash
npm run build
```

## 命令行使用

### 打開指定影片
```bash
npm start path/to/video.mp4
```

### 打開影片並跳轉到標籤
```bash
npm start path/to/video.mp4 --tag scene1
```

### 啟用調試模式
```bash
npm start --debug
```

## 文件格式

### 標籤數據結構 (JSON)
```json
{
  "timelines": [
    {
      "time": 0,
      "title": "開場",
      "description": "影片開始"
    },
    {
      "time": 90,
      "title": "關鍵場景",
      "description": "重要情節點"
    }
  ]
}
```

## 開發指南

詳細的開發指南、最佳實踐和 Commander.js 文檔，請參考 `.github/copilot-instructions.md`

## 主要開發要點

- ✅ **每次編輯後運行 `npm start` 測試**
- ✅ **確保主渲染進程通信的安全性**
- ✅ **使用繁體中文進行 UI 本地化**
- ✅ **遵循跨平台兼容性要求**
- ✅ **在提交前進行充分測試**

## 安全性考慮

- 上下文隔離已啟用（`contextIsolation: true`）
- 預加載腳本用於 IPC 通信
- 沙箱模式已啟用
- 禁用遠程模塊和遠程內容加載

## 跨平台支持

### Windows
- 支援 Windows 10/11
- NSIS 和 Portable 安裝程序格式
- 代碼簽名支援

### macOS
- 支援 macOS 10.13+
- Apple Silicon (M1/M2) 和 Intel 架構
- DMG 和 ZIP 分發格式
- 應用簽名和公證支援

## 許可證

ISC License

## 作者

TagVideoPlayer 開發團隊

---

**最後更新**: 2025-12-09
**版本**: 1.0.2
