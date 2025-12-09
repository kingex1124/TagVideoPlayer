/**
 * TagVideoPlayer - 主進程入口
 */

const { app, Menu, nativeTheme } = require('electron');
const { program } = require('commander');
const path = require('path');
const windowManager = require('./src/main-process/window-manager');

// 解析命令行參數
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
      global.initialFile = filePath;
      global.initialTag = options.tag;
    }
    if (options.debug) {
      process.env.DEBUG = true;
    }
  });

program.parse(process.argv);

// 設置 IPC 處理器（應在任何窗口創建前設置）
windowManager.setupIpcHandlers();

// 應用事件處理
app.on('ready', () => {
  const mainWindow = windowManager.createMainWindow();
  createMenu();

  // 如果有初始文件，加載它
  if (global.initialFile) {
    mainWindow.webContents.on('did-finish-load', () => {
      windowManager.handleFileDrop(global.initialFile);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (windowManager.getMainWindow() === null) {
    windowManager.createMainWindow();
    windowManager.setupIpcHandlers();
  }
});

/**
 * 創建應用菜單
 */
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    {
      label: isMac ? 'TagVideoPlayer' : '文件',
      submenu: [
        {
          label: '打開影片',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            // 菜單點擊時打開文件對話框
          },
        },
        {
          label: isMac ? '退出' : '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: '編輯',
      submenu: [
        { label: '撤銷', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: '複製', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: '粘貼', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      ],
    },
    {
      label: '幫助',
      submenu: [
        {
          label: '關於 TagVideoPlayer',
          click: () => {
            // 顯示關於對話框
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
