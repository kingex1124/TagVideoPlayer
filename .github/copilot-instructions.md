# TagVideoPlayer - Copilot 開發指南

## 一、系統語系設定
- **應用語系**: zh-TW (繁體中文)
- 所有用戶界面文本應使用繁體中文

## 二、Electron 應用最佳實踐

### 2.1 架構設計
- **主進程 (Main Process)**: 使用 `main.js` 管理應用生命週期、窗口和系統集成
- **渲染進程 (Renderer Process)**: 負責 UI 展示和用戶交互，使用 HTML/CSS/JavaScript
- **進程通信**: 使用 IPC (Inter-Process Communication) 進行主渲染進程通信

### 2.2 跨平台兼容性 (Windows & macOS)

#### Windows 特定配置
- 使用原生 Windows API 接口（通過 native modules）
- 應用簽名：使用代碼簽名證書
- 安裝程序格式：NSIS + Portable

#### macOS 特定配置
- 遵循 macOS 應用開發規範
- 應用簽名和公證必須進行（App Store 分發）
- 支援 Apple Silicon (M1/M2) 和 Intel 架構
- DMG 和 ZIP 分發格式

### 2.3 安全性最佳實踐
- **上下文隔離**: 啟用 `contextIsolation: true` 保護應用安全
- **預加載腳本**: 使用預加載腳本暴露必要的 IPC 接口
- **內容安全策略 (CSP)**: 實現嚴格的 CSP 防止 XSS 攻擊
- **外部資源**: 禁止加載遠程內容，使用本地資源

### 2.4 性能優化
- **延遲加載**: 按需加載模塊和資源
- **内存管理**: 及時釋放不用的資源，避免內存洩漏
- **代碼分割**: 將應用代碼分割為模塊，優化加載時間

### 2.5 開發工作流
- **構建要求**: 每次編輯代碼後，必須運行 `npm start` 或 `npm run dev` 測試
- **打包要求**: 使用 `npm run build` 創建平台特定的安裝程序
  - `npm run build-win`: 構建 Windows 安裝程序
  - `npm run build-mac`: 構建 macOS 安裝程序

### 2.6 代碼風格指南
- **文件結構**:
  ```
  TagVideoPlayer/
  ├── main.js                 # 主進程入口
  ├── package.json
  ├── src/
  │   ├── main-process/       # 主進程相關代碼
  │   ├── renderer/           # 渲染進程相關代碼
  │   │   ├── index.html
  │   │   ├── styles.css
  │   │   └── app.js
  │   ├── preload.js         # 預加載腳本
  │   └── utils/             # 工具函數
  ├── .github/
  │   └── copilot-instructions.md
  └── assets/                # 圖標和靜態資源
  ```

- **命名規範**:
  - 文件名: 使用小寫 kebab-case (例: `main-window.js`)
  - 函數/類: 使用 camelCase (例: `createMainWindow`)
  - 常量: 使用大寫 SNAKE_CASE (例: `WINDOW_WIDTH`)

- **JavaScript 風格**:
  - 使用 ES6+ 語法 (const/let, 箭頭函數等)
  - 添加 JSDoc 註釋說明函數功能
  - 使用 try-catch 處理錯誤

### 2.7 測試程序

#### Windows 測試
- 測試在 Windows 10/11 上的運行
- 驗證文件拖放功能
- 測試標籤保存和加載
- 驗證應用簽名和安裝程序

#### macOS 測試
- 測試在 macOS 10.13+ 上的運行
- 驗證 Apple Silicon 兼容性
- 測試菜單欄集成
- 驗證代碼簽名和公證

### 2.8 提交信息約定

使用以下格式的提交信息:
```
<type>(<scope>): <subject>

<body>

<footer>
```

類型 (type):
- `feat`: 新功能
- `fix`: 修復 bug
- `docs`: 文檔更新
- `style`: 代碼風格調整
- `refactor`: 代碼重構
- `test`: 測試相關
- `chore`: 構建、依賴等

示例:
```
feat(tagging): 實現標籤創建和保存功能

- 添加標籤輸入界面
- 實現 JSON 文件持久化
- 支持自動加載標籤

Closes #123
```

---

## 三、Commander.js 命令行解析工具

### 3.1 為什麼選擇 Commander.js

**優點**:
- 簡潔而強大的 API
- 自動生成幫助和版本信息
- 廣泛社區支持和文檔
- 支持子命令和選項驗證
- 跨平台兼容性強 (Windows & macOS)

**主要特性**:
- 命令解析和驗證
- 自動幫助生成
- 版本和選項管理
- 錯誤處理

### 3.2 基本用法

#### 安裝
```bash
npm install commander
```

#### 簡單示例
```javascript
const { program } = require('commander');

program
  .version('1.0.0')
  .description('TagVideoPlayer - 影片播放器');

program
  .command('play <file>')
  .description('播放影片文件')
  .option('-t, --tag <tag>', '直接跳轉到指定標籤')
  .action((file, options) => {
    console.log(`播放文件: ${file}`);
    if (options.tag) {
      console.log(`跳轉到標籤: ${options.tag}`);
    }
  });

program.parse(process.argv);
```

### 3.3 TagVideoPlayer 應用場景

#### 命令行參數示例
```bash
# 打開影片文件
npm start video.mp4

# 指定初始標籤
npm start video.mp4 --tag scene1

# 顯示版本信息
npm start --version

# 顯示幫助信息
npm start --help
```

#### 實現代碼
```javascript
const { program } = require('commander');
const path = require('path');

program
  .version('1.0.0')
  .description('TagVideoPlayer - 跨平台影片播放器應用');

program
  .arguments('[videoFile]')
  .option('-t, --tag <name>', '啟動時跳轉到指定標籤')
  .option('--debug', '啟用調試模式')
  .action((videoFile, options) => {
    if (videoFile) {
      const filePath = path.resolve(videoFile);
      // 傳遞給主進程進行處理
      global.initialFile = filePath;
      global.initialTag = options.tag;
    }
    if (options.debug) {
      global.debugMode = true;
    }
  });

program.parse(process.argv);
```

### 3.4 高級用法

#### 選項驗證
```javascript
program
  .option('-p, --port <port>', '服務器端口', (value) => {
    const port = parseInt(value, 10);
    if (isNaN(port)) {
      throw new Error('Port must be a number');
    }
    return port;
  });
```

#### 子命令
```javascript
program
  .command('tag <action>')
  .description('標籤管理命令')
  .option('-f, --file <file>', '影片文件路徑')
  .action((action, options) => {
    // 處理標籤管理
  });
```

### 3.5 Commander.js 完整 API 文檔

詳細文檔: https://github.com/tj/commander.js/blob/master/README.md

主要方法:
- `program.version(version)`: 設置版本號
- `program.description(description)`: 設置應用描述
- `program.command(name)`: 定義命令
- `program.option(flags, description, defaultValue)`: 定義選項
- `program.arguments(pattern)`: 定義參數模式
- `program.action(fn)`: 執行操作
- `program.parse(argv)`: 解析命令行參數

---

## 四、開發指南總結

### 4.1 快速開始
```bash
# 安裝依賴
npm install

# 啟動應用 (開發模式)
npm start

# 構建 Windows 版本
npm run build-win

# 構建 macOS 版本
npm run build-mac

# 構建所有平台
npm run build
```

### 4.2 項目目錄結構
```
TagVideoPlayer/
├── main.js                              # 應用主進程入口
├── package.json                         # 項目配置
├── src/
│   ├── main-process/
│   │   ├── window-manager.js           # 窗口管理
│   │   ├── file-handler.js             # 文件處理
│   │   └── tag-manager.js              # 標籤管理
│   ├── renderer/
│   │   ├── index.html                  # 主窗口 HTML
│   │   ├── styles.css                  # 樣式文件
│   │   └── app.js                      # 應用邏輯
│   ├── preload.js                      # IPC 預加載腳本
│   └── utils/
│       ├── file-utils.js               # 文件工具函數
│       └── json-handler.js             # JSON 操作
├── assets/                              # 圖標和資源
├── .github/
│   └── copilot-instructions.md         # 本文檔
└── .gitignore
```

### 4.3 開發流程
1. **代碼編輯**: 修改 src/ 中的文件
2. **測試**: 運行 `npm start` 測試改動
3. **提交**: 使用規範的提交信息提交代碼
4. **構建**: 準備發佈時運行 `npm run build`

### 4.4 關鍵開發要點
- ✅ 每次編輯後必須運行 `npm start` 或 `npm run dev` 測試
- ✅ 保持主渲染進程通信的安全性
- ✅ 使用繁體中文進行用戶界面本地化
- ✅ 遵循跨平台兼容性要求
- ✅ 在提交前進行充分測試

---

## 五、參考資源

- **Electron 官方文檔**: https://www.electronjs.org/docs
- **Commander.js 文檔**: https://github.com/tj/commander.js
- **Electron Builder**: https://www.electron.build/
- **VSCode Electron 擴展**: 用於 Electron 開發調試

---

*最後更新: 2025-12-09*
