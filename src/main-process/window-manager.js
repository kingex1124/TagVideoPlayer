/**
 * 窗口管理器
 */

const { BrowserWindow, ipcMain, dialog, app } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const fs = require('fs');
const jsonHandler = require('../utils/json-handler');
const fileUtils = require('../utils/file-utils');

let mainWindow = null;
let currentVideoPath = null;

/**
 * 創建主窗口
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: true, // 允許渲染進程取得 File.path
      enableRemoteModule: false,
      sandbox: false, // 需讀取拖放檔案的實際路徑，關閉 sandbox 以取得 file.path
    },
  });

  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);

  // 攔截因拖放而觸發的導航，直接處理 file:// 路徑
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url && url.startsWith('file://')) {
      event.preventDefault();
      try {
        const filePath = fileURLToPath(url);
        handleFileDrop(filePath);
      } catch (error) {
        console.error('will-navigate decode drop failed:', error);
      }
    }
  });

  // 防止新窗口被打開，統一在現有窗口處理
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // 開發時打開開發者工具
  if (process.env.DEBUG) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 設置拖放事件
  setupDragAndDrop();

  return mainWindow;
}

/**
 * 設置拖放事件
 * 注意：webContents 級別的拖放事件在 Electron 中有限制
 * 因此主要通過渲染進程的 IPC 通信來處理
 */
function setupDragAndDrop() {
  if (!mainWindow) return;

  // 設置 IPC 處理器來接收從渲染進程拖放過來的文件路徑
  ipcMain.handle('file:drop-handler', async (event, filePath) => {
    if (filePath) {
      handleFileDrop(filePath);
      return { success: true };
    }
    return { success: false };
  });

  // 提供暫存標籤檔路徑，給無 filePath 拖放的情境使用
  ipcMain.handle('file:temp-tag-path', async (event, fileName) => {
    try {
      const safeName = (fileName || 'video').replace(/[\\/:*?"<>|]/g, '_');
      const tempDir = path.join(app.getPath('temp'), 'TagVideoPlayer');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const fullPath = path.join(tempDir, safeName);
      return { success: true, path: fullPath };
    } catch (error) {
      console.error('temp-tag-path error:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * 設置 IPC 事件監聽器
 */
function setupIpcHandlers() {
  // 打開文件對話框
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        {
          name: '影片文件',
          extensions: ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm'],
        },
        {
          name: '所有文件',
          extensions: ['*'],
        },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      currentVideoPath = filePath;
      return filePath;
    }

    return null;
  });

  // 加載標籤
  ipcMain.handle('tags:load', async (event, videoPath) => {
    try {
      currentVideoPath = videoPath;
      console.log(`[tags:load] request path: ${videoPath}`);
      let tags = jsonHandler.loadTags(videoPath);

      // 若從暫存路徑載入且沒有資料，嘗試從 userData/tags/<basename>.json 載入
      if ((!tags || tags.length === 0) && videoPath && videoPath.includes(path.join(app.getPath('temp'), 'TagVideoPlayer'))) {
        const safeName = path.basename(videoPath).replace(/[\\/:*?"<>|]/g, '_');
        const userTagsDir = path.join(app.getPath('userData'), 'tags');
        const userTagPath = path.join(userTagsDir, `${safeName}.json`);
        if (fs.existsSync(userTagPath)) {
          console.log(`[tags:load] fallback userData path: ${userTagPath}`);
          tags = jsonHandler.loadTags(userTagPath);
        }
      }

      console.log(`[tags:load] loaded count: ${tags.length}`);
      return { success: true, tags };
    } catch (error) {
      console.error('Error loading tags:', error);
      return { success: false, error: error.message };
    }
  });

  // 保存標籤
  ipcMain.handle('tags:save', async (event, videoPath, tags) => {
    try {
      const success = jsonHandler.saveTags(videoPath, tags);

      // 若為暫存路徑，額外同步到 userData/tags 以便下次拖曳可讀
      if (videoPath && videoPath.includes(path.join(app.getPath('temp'), 'TagVideoPlayer'))) {
        const safeName = path.basename(videoPath).replace(/[\\/:*?"<>|]/g, '_');
        const userTagsDir = path.join(app.getPath('userData'), 'tags');
        if (!fs.existsSync(userTagsDir)) {
          fs.mkdirSync(userTagsDir, { recursive: true });
        }
        const userTagPath = path.join(userTagsDir, `${safeName}.json`);
        jsonHandler.saveTags(userTagPath, tags);
      }

      return { success };
    } catch (error) {
      console.error('Error saving tags:', error);
      return { success: false, error: error.message };
    }
  });

}

/**
 * 處理文件拖放
 * @param {string} filePath 文件路徑
 */
function handleFileDrop(filePath) {
  if (mainWindow) {
    currentVideoPath = filePath;
    mainWindow.webContents.send('file:dropped', filePath);
  }
}

/**
 * 獲取主窗口
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * 獲取當前影片路徑
 */
function getCurrentVideoPath() {
  return currentVideoPath;
}

module.exports = {
  createMainWindow,
  setupIpcHandlers,
  handleFileDrop,
  getMainWindow,
  getCurrentVideoPath,
};
