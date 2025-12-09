/**
 * 預加載腳本
 * 在渲染進程和主進程之間提供安全的 IPC 通信
 */

const { contextBridge, ipcRenderer } = require('electron');

// 將 drop 事件注入 main world，以取得 file.path 並回傳，需等待 DOM 準備好
function injectMainWorldDropListener() {
  const code = `
    (function() {
      const dispatch = (payload) => {
        window.postMessage({ __ELECTRON_DROP_FILE__: true, ...payload }, '*');
      };

      window.addEventListener('drop', (e) => {
        const dt = e?.dataTransfer;
        const file = dt?.files?.[0];
        const filePath = file?.path;
        const fileName = file?.name || '';

        if (!filePath) {
          console.info('[drop][main world] no file.path', { hasFile: !!file, fileName });
        }

        if (filePath) {
          e.preventDefault();
          console.info('[drop][main world] got file.path', { filePath, fileName });
          dispatch({ path: filePath, name: fileName });
        }
      }, true);
    })();
  `;

  const inject = () => {
    try {
      const script = document.createElement('script');
      script.textContent = code;
      (document.documentElement || document.head || document.body || document).appendChild(script);
      script.remove();
    } catch (error) {
      console.error('[preload] inject drop bridge failed:', error);
    }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    inject();
  } else {
    window.addEventListener('DOMContentLoaded', inject, { once: true });
  }
}

// 監聽 main world 的 postMessage 並轉為 CustomEvent，供渲染程式接收
function wireDropMessageBridge() {
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.__ELECTRON_DROP_FILE__) {
      const detail = { path: data.path || '', name: data.name || '' };
      window.dispatchEvent(new CustomEvent('electron-drop-file-path', { detail }));
    }
  });
}

injectMainWorldDropListener();
wireDropMessageBridge();

// 向渲染進程暴露安全的 IPC 方法
contextBridge.exposeInMainWorld('videoAPI', {
  /**
   * 打開文件對話框
   */
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  /**
   * 加載影片標籤
   * @param {string} videoPath 影片文件路徑
   */
  loadTags: (videoPath) => ipcRenderer.invoke('tags:load', videoPath),

  /**
   * 保存影片標籤
   * @param {string} videoPath 影片文件路徑
   * @param {Array} tags 標籤數據
   */
  saveTags: (videoPath, tags) => ipcRenderer.invoke('tags:save', videoPath, tags),

  /**
   * 處理拖放文件
   * @param {string} filePath 文件路徑
   */
  handleFileDrop: (filePath) => ipcRenderer.invoke('file:drop-handler', filePath),

  /**
   * 監聽文件拖放事件
   */
  onFileDropped: (callback) => ipcRenderer.on('file:dropped', (event, file) => callback(file)),

  /**
   * 刪除文件拖放監聽
   */
  offFileDropped: () => ipcRenderer.removeAllListeners('file:dropped'),

  /**
   * 取得暫存標籤檔案路徑
   * @param {string} fileName 檔名
   */
  getTempTagPath: (fileName) => ipcRenderer.invoke('file:temp-tag-path', fileName),
});
