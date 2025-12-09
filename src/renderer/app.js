/**
 * TagVideoPlayer - 渲染進程應用邏輯
 */

class TagVideoPlayerApp {
  constructor() {
    this.videoPlayer = null;
    this.currentVideoPath = null;
    this.currentTagPath = null;
    this.tags = [];
    this.currentTagIndex = -1;
    this.editingTagIndex = -1;
    this.editingTagTime = -1; // 保存編輯時的時間戳
    this.isHandlingDrop = false;

    this.initializeElements();
    this.attachEventListeners();
    this.loadInitialState();

    console.info('[env]', {
      hasProcess: typeof process !== 'undefined',
      sandboxed: typeof process !== 'undefined' ? process.sandboxed : 'n/a',
      electron: typeof process !== 'undefined' ? process.versions?.electron : 'n/a',
      chrome: typeof process !== 'undefined' ? process.versions?.chrome : 'n/a',
      filePathInFileProto: typeof File !== 'undefined'
        ? Object.prototype.hasOwnProperty.call(File.prototype, 'path')
        : 'n/a',
    });
  }

  /**
   * 初始化 DOM 元素
   */
  initializeElements() {
    this.videoPlayer = document.getElementById('videoPlayer');
    this.videoPlaceholder = document.getElementById('videoPlaceholder');
    this.btnOpen = document.getElementById('btnOpen');
    this.tagList = document.getElementById('tagList');
    this.btnAddTag = document.getElementById('btnAddTag');
    this.btnClearTags = document.getElementById('btnClearTags');
    this.tagEditor = document.getElementById('tagEditor');
    this.tagTitle = document.getElementById('tagTitle');
    this.tagDescription = document.getElementById('tagDescription');
    this.tagTime = document.getElementById('tagTime');
    this.btnSaveTag = document.getElementById('btnSaveTag');
    this.btnCancelTag = document.getElementById('btnCancelTag');
  }

  /**
   * 綁定事件監聽器
   */
  attachEventListeners() {
    // 打開文件按鈕
    this.btnOpen.addEventListener('click', () => this.openVideo());

    // 新增標籤
    this.btnAddTag.addEventListener('click', () => this.createNewTag());

    // 清除所有標籤
    this.btnClearTags.addEventListener('click', () => this.clearAllTags());

    // 保存標籤
    this.btnSaveTag.addEventListener('click', () => this.saveCurrentTag());

    // 取消編輯
    this.btnCancelTag.addEventListener('click', () => this.cancelEditTag());

    // 影片播放事件
    this.videoPlayer.addEventListener('loadedmetadata', () => this.onVideoLoaded());
    this.videoPlayer.addEventListener('timeupdate', () => this.updateTagList());
    this.videoPlayer.addEventListener('ended', () => this.onVideoEnded());

    // 拖放事件
    this.setupDragAndDrop();

    // 時間欄位即時更新
    this.tagTime.addEventListener('input', () => {
      const parsed = this.parseTimeInput(this.tagTime.value);
      if (parsed !== null && parsed >= 0) {
        this.editingTagTime = parsed;
      }
    });

    this.tagTime.addEventListener('blur', () => {
      const parsed = this.parseTimeInput(this.tagTime.value);
      if (parsed !== null && parsed >= 0) {
        this.editingTagTime = parsed;
        this.tagTime.value = this.formatTimeWithMs(parsed);
      }
    });

    // 監聽文件拖放（從主進程）
    if (window.videoAPI) {
      window.videoAPI.onFileDropped((filePath) => this.loadVideo(filePath));
    }

    // 監聽 main world postMessage 傳回的檔案路徑
    window.addEventListener('electron-drop-file-path', (event) => {
      const { path, name } = event.detail || {};
      if (path) {
        console.info('[drop] path from main world', { path, name });
        this.handleDroppedPath(path, name || path);
      }
    });
  }

  /**
   * 設置拖放事件
   */
  setupDragAndDrop() {
    const container = document.querySelector('.video-container');
    const placeholder = document.getElementById('videoPlaceholder');

    const extractDropInfo = (e) => {
      const dataTransfer = e?.dataTransfer;
      if (!dataTransfer) {
        return { path: '', name: '', file: null };
      }

      const file = dataTransfer.files?.[0];
      const fileName = file?.name || '';
      const filePaths = Array.isArray(dataTransfer.filePaths) ? dataTransfer.filePaths : [];
      const candidates = [
        file?.path,
        filePaths[0],
        dataTransfer.getData?.('text/uri-list'),
        dataTransfer.getData?.('text/plain'),
      ];

      for (const raw of candidates) {
        const normalized = this.normalizeFilePath(raw);
        if (this.isUsableFilePath(normalized)) {
          const derivedName = fileName || this.deriveNameFromPath(normalized) || raw || '';
          return { path: normalized, name: derivedName, file };
        }
      }

      return { path: '', name: fileName, file };
    };

    const handleDrop = async (e) => {
      const dt = e?.dataTransfer;
      const firstFile = dt?.files?.[0];
      const debugInfo = {
        types: dt?.types ? Array.from(dt.types) : [],
        fileName: firstFile?.name,
        filePath: firstFile?.path,
        filePaths: dt?.filePaths,
        uriList: dt?.getData?.('text/uri-list'),
        textPlain: dt?.getData?.('text/plain'),
      };
      console.info('[drop] raw dataTransfer', debugInfo);

      const { path: dropPath, name, file } = extractDropInfo(e);

      if (dropPath) {
        e.preventDefault();
        console.info('[drop] resolved path', { path: dropPath, name });
        await this.handleDroppedPath(dropPath, name);
        return true;
      }

      if (file) {
        console.info('[drop] fallback file object', { name: file.name });
        // 不阻止預設行為，讓 BrowserWindow 嘗試導航到 file://
        // 主進程 will-navigate 會攔截並回傳真實路徑
        return false;
      }

      console.warn('Drop without usable path', { name });
      return false;
    };

    const addAreaListeners = (el) => {
      if (!el) return;
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        container.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
      });
      el.addEventListener('dragleave', () => {
        container.style.backgroundColor = '';
      });
      el.addEventListener('drop', async (e) => {
        container.style.backgroundColor = '';
        const handled = await handleDrop(e);
        if (handled) {
          e.preventDefault();
        }
      });
    };

    addAreaListeners(container);
    addAreaListeners(placeholder);
  }

  /**
   * 直接處理已知路徑的影片
   * @param {string} filePath 檔案路徑
   * @param {string} [fileName] 檔名
   */
  async handleDroppedPath(filePath, fileName = '') {
    const normalizedPath = this.normalizeFilePath(filePath);
    const resolvedPath = this.isUsableFilePath(normalizedPath) ? normalizedPath : null;

    if (!resolvedPath) {
      this.showNotification('無法讀取拖放的影片路徑', 'error');
      return;
    }

    const displayName = fileName || resolvedPath;

    if (!this.isVideoFile(displayName)) {
      this.showNotification('請拖放影片文件', 'warning');
      return;
    }

    // 通過 IPC 發送文件路徑到主進程
    if (window.videoAPI) {
      try {
        const result = await window.videoAPI.handleFileDrop(resolvedPath);
        if (result && result.success) {
          await this.loadVideo(resolvedPath);
          return;
        }
      } catch (error) {
        console.error('handleFileDrop IPC error:', error);
      }
    }

    // 備用方案：即使 IPC 失敗也直接加載
    await this.loadVideo(resolvedPath);
  }

  /**
   * 處理沒有 path 的檔案（Blob）
   * @param {File} file 檔案物件
   */
  async handleDroppedFileBlob(file) {
    if (!file) {
      this.showNotification('無法讀取拖放的影片', 'error');
      return;
    }

    if (!this.isVideoFile(file.name)) {
      this.showNotification('請拖放影片文件', 'warning');
      return;
    }

    const tagPath = await this.resolveTempTagPath(file.name);
    const objectUrl = URL.createObjectURL(file);

    console.info('[drop] using object URL', { name: file.name, tagPath });
    await this.loadVideo(objectUrl, tagPath, { useDirectUrl: true, skipNormalize: true });
  }

  /**
   * 檢查是否為影片文件
   * @param {string} filename 文件名
   * @returns {boolean}
   */
  isVideoFile(filename) {
    const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm'];
    const extension = filename.split('.').pop().toLowerCase();
    return videoExtensions.includes(extension);
  }

  /**
   * 判斷字串是否為可用的檔案路徑
   * @param {string} filePath 檔案路徑
   * @returns {boolean}
   */
  isUsableFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    if (/^file:\/\//i.test(filePath)) {
      return true;
    }

    if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')) {
      return true;
    }

    if (filePath.startsWith('/')) {
      return true;
    }

    const hasSeparator = filePath.includes('\\') || filePath.includes('/');
    const looksLikeUrl = /^[A-Za-z]+:\/\//.test(filePath);
    return hasSeparator && !looksLikeUrl;
  }

  /**
   * 從路徑推導檔名
   * @param {string} p 路徑
   * @returns {string}
   */
  deriveNameFromPath(p) {
    if (!p || typeof p !== 'string') return '';
    const parts = p.split(/[/\\]/);
    return parts[parts.length - 1] || '';
  }

  /**
   * 取得暫存標籤檔案路徑
   * @param {string} fileName 檔名
   * @returns {Promise<string>}
   */
  async resolveTempTagPath(fileName) {
    const fallbackName = fileName || 'video';
    try {
      if (window.videoAPI?.getTempTagPath) {
        const result = await window.videoAPI.getTempTagPath(fallbackName);
        if (result && result.success && result.path) {
          return result.path;
        }
      }
    } catch (error) {
      console.error('resolveTempTagPath error:', error);
    }
    return fallbackName;
  }

  /**
   * 打開影片文件
   */
  async openVideo() {
    try {
      if (window.videoAPI) {
        const filePath = await window.videoAPI.openFile();
        if (filePath) {
          await this.loadVideo(filePath);
          return filePath;
        }
      }
    } catch (error) {
      console.error('Error opening video:', error);
      this.showNotification('打開文件失敗', 'error');
    }
    return null;
  }

  /**
   * 加載影片
   * @param {string} filePath 影片文件路徑
   */
  async loadVideo(filePath, tagPathOverride = null, options = {}) {
    try {
      const useDirectUrl = options.useDirectUrl === true;
      const skipNormalize = options.skipNormalize === true;

      const normalizedPath = skipNormalize ? filePath : (this.normalizeFilePath(filePath) || filePath);
      const tagPath = tagPathOverride || normalizedPath;
      this.currentVideoPath = normalizedPath;
      this.currentTagPath = tagPath;
      console.info('[video] load', { video: normalizedPath, tagPath });

      // 檢查文件存在（簡單驗證）
      const videoUrl = useDirectUrl
        ? normalizedPath
        : encodeURI(`file:///${normalizedPath.replace(/\\/g, '/')}`);
      this.videoPlayer.src = videoUrl;

      // 顯示影片播放器，隱藏占位符
      this.videoPlayer.classList.add('active');
      this.videoPlaceholder.classList.add('hidden');

      // 加載標籤
      await this.loadTags(tagPath);
    } catch (error) {
      console.error('Error loading video:', error);
      this.showNotification('加載影片失敗', 'error');
    }
  }

  /**
   * 加載標籤數據
   * @param {string} videoPath 影片路徑
   */
  async loadTags(videoPath) {
    try {
      if (window.videoAPI) {
        console.info('[tags] loading via IPC', { path: videoPath });
        const result = await window.videoAPI.loadTags(videoPath);
        if (result.success) {
          this.tags = result.tags || [];
          this.renderTagList();
          this.showNotification(`已加載 ${this.tags.length} 個標籤`, 'success');
        } else {
          this.tags = [];
          this.renderTagList();
        }
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      this.tags = [];
      this.renderTagList();
    }
  }

  /**
   * 保存標籤到文件
   */
  async saveTags() {
    if (!this.currentTagPath || !window.videoAPI) {
      return;
    }

    try {
      const result = await window.videoAPI.saveTags(this.currentTagPath, this.tags);
      if (result.success) {
        console.log('Tags saved successfully');
      } else {
        console.error('Failed to save tags:', result.error);
      }
    } catch (error) {
      console.error('Error saving tags:', error);
    }
  }

  /**
   * 渲染標籤列表
   */
  renderTagList() {
    this.tagList.innerHTML = '';

    if (this.tags.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'tag-item empty';
      emptyItem.textContent = '沒有標籤，點擊下方按鈕新增';
      emptyItem.style.pointerEvents = 'none';
      this.tagList.appendChild(emptyItem);
      return;
    }

    this.tags.forEach((tag, index) => {
      const item = document.createElement('li');
      item.className = 'tag-item';
      if (index === this.currentTagIndex) {
        item.classList.add('active');
      }

      const timeStr = this.formatTime(tag.time);
      item.innerHTML = `
        <div class="tag-time">${timeStr}</div>
        <div class="tag-title">${this.escapeHtml(tag.title)}</div>
        ${tag.description ? `<div class="tag-description">${this.escapeHtml(tag.description)}</div>` : ''}
        <div class="tag-actions">
          <button class="btn-delete" data-index="${index}">刪除</button>
          <button class="btn-edit" data-index="${index}">編輯</button>
        </div>
      `;

      // 點擊標籤跳轉
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.tag-actions')) {
          this.jumpToTag(index);
        }
      });

      // 編輯按鈕
      const editBtn = item.querySelector('.btn-edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editTag(index);
      });

      // 刪除按鈕
      const deleteBtn = item.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTag(index);
      });

      this.tagList.appendChild(item);
    });
  }

  /**
   * 跳轉到標籤時間
   * @param {number} index 標籤索引
   */
  jumpToTag(index) {
    if (index >= 0 && index < this.tags.length) {
      const tag = this.tags[index];
      this.videoPlayer.currentTime = tag.time;
      this.currentTagIndex = index;
      this.renderTagList();
    }
  }

  /**
   * 創建新標籤
   */
  createNewTag() {
    if (!this.currentVideoPath) {
      this.showNotification('請先打開影片', 'warning');
      return;
    }

    const currentTime = this.videoPlayer.currentTime;
    this.editingTagIndex = this.tags.length;

    // 檢查是否已有相同時間的標籤
    const existingIndex = this.tags.findIndex((tag) => Math.abs(tag.time - currentTime) < 0.5);
    if (existingIndex !== -1) {
      this.editingTagIndex = existingIndex;
    }

    // 顯示編輯器並自動填入當前時間
    this.showTagEditor(currentTime, '', '');
    // 自動聚焦於標題輸入框
    setTimeout(() => {
      this.tagTitle.focus();
    }, 50);
  }

  /**
   * 編輯標籤
   * @param {number} index 標籤索引
   */
  editTag(index) {
    if (index >= 0 && index < this.tags.length) {
      const tag = this.tags[index];
      this.editingTagIndex = index;
      this.showTagEditor(tag.time, tag.title, tag.description);
    }
  }

  /**
   * 顯示標籤編輯器
   * @param {number} time 時間戳
   * @param {string} title 標籤名稱
   * @param {string} description 標籤描述
   */
  showTagEditor(time, title = '', description = '') {
    this.editingTagTime = time; // 保存編輯時的時間
    this.tagTime.value = this.formatTimeWithMs(time);
    this.tagTitle.value = title;
    this.tagDescription.value = description;
    this.tagEditor.style.display = 'block';

    // 聚焦於標題輸入框
    this.tagTitle.focus();
  }

  /**
   * 隱藏標籤編輯器
   */
  hideTagEditor() {
    this.tagEditor.style.display = 'none';
    this.editingTagIndex = -1;
    this.editingTagTime = -1;
  }

  /**
   * 保存當前編輯的標籤
   */
  saveCurrentTag() {
    const title = this.tagTitle.value.trim();
    const description = this.tagDescription.value.trim();
    const parsedTime = this.parseTimeInput(this.tagTime.value);
    let time = parsedTime !== null && parsedTime >= 0 ? parsedTime : this.editingTagTime;
    if (!(time >= 0)) {
      time = this.videoPlayer.currentTime;
    }

    if (!title) {
      this.showNotification('標籤名稱不能為空', 'warning');
      return;
    }

    if (!(time >= 0)) {
      this.showNotification('時間格式不正確，請輸入 HH:MM:SS 或秒數', 'warning');
      return;
    }

    // 標準化時間（毫秒精度）
    const normalizedTime = Math.round(time * 1000) / 1000;
    this.editingTagTime = normalizedTime;

    const isExistingTag = this.editingTagIndex >= 0 && this.editingTagIndex < this.tags.length;

    if (!isExistingTag) {
      // 新增標籤
      const newTag = {
        time: normalizedTime,
        title: title,
        description: description,
      };
      this.tags.push(newTag);
      this.editingTagIndex = this.tags.length - 1;
    } else {
      // 編輯現有標籤
      this.tags[this.editingTagIndex].time = normalizedTime;
      this.tags[this.editingTagIndex].title = title;
      this.tags[this.editingTagIndex].description = description;
    }

    // 按時間排序
    this.tags.sort((a, b) => a.time - b.time);

    // 保存到文件
    this.saveTags();

    // 更新 UI
    this.renderTagList();
    this.hideTagEditor();
    this.showNotification('標籤已保存', 'success');
  }

  /**
   * 取消編輯標籤
   */
  cancelEditTag() {
    this.hideTagEditor();
  }

  /**
   * 刪除標籤
   * @param {number} index 標籤索引
   */
  deleteTag(index) {
    if (index >= 0 && index < this.tags.length) {
      const title = this.tags[index].title;
      if (confirm(`確定要刪除標籤「${title}」嗎？`)) {
        this.tags.splice(index, 1);
        this.saveTags();
        this.renderTagList();
        this.showNotification('標籤已刪除', 'success');
      }
    }
  }

  /**
   * 清除所有標籤
   */
  clearAllTags() {
    if (this.tags.length === 0) {
      this.showNotification('沒有標籤可清除', 'info');
      return;
    }

    if (confirm(`確定要清除所有 ${this.tags.length} 個標籤嗎？`)) {
      this.tags = [];
      this.saveTags();
      this.renderTagList();
      this.showNotification('所有標籤已清除', 'success');
    }
  }

  /**
   * 影片加載完成
   */
  onVideoLoaded() {
    console.log(
      `Video loaded: ${this.videoPlayer.duration.toFixed(2)}s`,
    );
  }

  /**
   * 影片播放結束
   */
  onVideoEnded() {
    console.log('Video ended');
  }

  /**
   * 更新標籤列表（跟進播放進度）
   */
  updateTagList() {
    // 可在此實現進度指示器等功能
  }

  /**
   * 加載初始狀態
   */
  loadInitialState() {
    // 預留用於加載應用初始狀態
  }

  /**
   * 格式化時間
   * @param {number} seconds 秒數
   * @returns {string} 格式化時間字符串
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) {
      parts.push(String(hours).padStart(2, '0'));
    }
    parts.push(String(minutes).padStart(2, '0'));
    parts.push(String(secs).padStart(2, '0'));

    return parts.join(':');
  }

  /**
   * 將秒數格式化為 HH:MM:SS(.ms)
   * @param {number} seconds 秒數
   * @returns {string}
   */
  formatTimeWithMs(seconds) {
    if (!Number.isFinite(seconds)) {
      return '00:00:00';
    }
    const whole = Math.floor(seconds);
    const base = this.formatTime(whole);
    const fractional = seconds - whole;
    if (fractional > 0) {
      const ms = Math.round(fractional * 1000);
      const msStr = String(ms).padStart(3, '0');
      return `${base}.${msStr}`;
    }
    return base;
  }

  /**
   * 將用戶輸入的時間解析為秒
   * 支援格式：HH:MM:SS、MM:SS、SS、小數秒
   * @param {string} value 用戶輸入
   * @returns {number|null} 秒數，若格式錯誤返回 null
   */
  parseTimeInput(value) {
    if (value === null || value === undefined) {
      return null;
    }
    const input = String(value).trim();
    if (!input) {
      return null;
    }

    if (input.includes(':')) {
      const parts = input.split(':').map((p) => p.trim()).filter((p) => p !== '');
      if (parts.length === 0) {
        return null;
      }
      let seconds = 0;
      let multiplier = 1;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const num = parseFloat(parts[i]);
        if (!Number.isFinite(num)) {
          return null;
        }
        seconds += num * multiplier;
        multiplier *= 60;
      }
      return seconds;
    }

    const numeric = parseFloat(input);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return numeric;
  }

  /**
   * 將 file:// URI 或普通路徑正規化為本地路徑
   * @param {string} input 路徑或 URI
   * @returns {string|null} 正規化後的路徑
   */
  normalizeFilePath(input) {
    if (!input || typeof input !== 'string') {
      return null;
    }

    const trimmed = input.trim().split('\n')[0]; // uri-list 可能包含多行
    if (!trimmed) return null;

    if (trimmed.startsWith('file://')) {
      try {
        const decoded = decodeURI(trimmed);
        // 移除協議前綴
        const withoutScheme = decoded.replace(/^file:\/\//i, '');
        // Windows 會變成 /C:/path，需要去掉前導斜線
        if (/^\/[A-Za-z]:/.test(withoutScheme)) {
          return withoutScheme.slice(1);
        }
        return withoutScheme;
      } catch (error) {
        console.error('normalizeFilePath decode error:', error);
        return null;
      }
    }

    // 若是一個看起來像路徑的字串，直接回傳
    if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) {
      return trimmed;
    }

    return trimmed;
  }

  /**
   * 轉義 HTML
   * @param {string} text 原始文本
   * @returns {string} 轉義後的文本
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 顯示通知
   * @param {string} message 消息內容
   * @param {string} type 消息類型（success, error, warning, info）
   */
  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // TODO: 實現視覺通知 UI
  }
}

// 應用啟動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TagVideoPlayerApp();
});
