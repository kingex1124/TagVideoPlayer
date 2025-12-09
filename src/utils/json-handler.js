/**
 * JSON 處理工具
 */

const fileUtils = require('./file-utils');

/**
 * 計算標籤檔案實際路徑
 * 若傳入已經是 .json 則直接使用
 * @param {string} videoPathOrTagPath 影片路徑或標籤路徑
 * @returns {string} 標籤檔案路徑
 */
function resolveTagFilePath(videoPathOrTagPath) {
  if (!videoPathOrTagPath) return '';

  if (videoPathOrTagPath.toLowerCase().endsWith('.json')) {
    return videoPathOrTagPath;
  }
  return fileUtils.getTagFilePath(videoPathOrTagPath);
}

/**
 * 加載標籤數據
 * @param {string} videoPathOrTagPath 影片文件路徑或標籤路徑
 * @returns {Array} 標籤數組
 */
function loadTags(videoPathOrTagPath) {
  try {
    const tagFilePath = resolveTagFilePath(videoPathOrTagPath);

    if (!fileUtils.fileExists(tagFilePath)) {
      console.log(`[tags] file not found: ${tagFilePath}`);
      return [];
    }

    console.log(`[tags] loading from: ${tagFilePath}`);
    const content = fileUtils.readFile(tagFilePath);
    const data = JSON.parse(content);

    return data.timelines || [];
  } catch (error) {
    console.error('Error loading tags:', error);
    return [];
  }
}

/**
 * 保存標籤數據
 * @param {string} videoPathOrTagPath 影片文件路徑或標籤路徑
 * @param {Array} tags 標籤數組
 */
function saveTags(videoPathOrTagPath, tags) {
  try {
    const tagFilePath = resolveTagFilePath(videoPathOrTagPath);
    const data = {
      timelines: tags || [],
    };

    const content = JSON.stringify(data, null, 2);
    fileUtils.writeFile(tagFilePath, content);

    return true;
  } catch (error) {
    console.error('Error saving tags:', error);
    return false;
  }
}

/**
 * 新增標籤
 * @param {Array} tags 現有標籤數組
 * @param {number} time 時間戳（秒）
 * @param {string} title 標籤名稱
 * @param {string} description 標籤描述
 * @returns {Array} 更新後的標籤數組
 */
function addTag(tags, time, title, description) {
  const newTag = {
    time: Math.round(time * 100) / 100, // 保留兩位小數
    title: title || '無標題',
    description: description || '',
  };

  tags.push(newTag);
  // 按時間排序
  tags.sort((a, b) => a.time - b.time);

  return tags;
}

/**
 * 刪除標籤
 * @param {Array} tags 標籤數組
 * @param {number} index 標籤索引
 * @returns {Array} 更新後的標籤數組
 */
function deleteTag(tags, index) {
  if (index >= 0 && index < tags.length) {
    tags.splice(index, 1);
  }
  return tags;
}

/**
 * 編輯標籤
 * @param {Array} tags 標籤數組
 * @param {number} index 標籤索引
 * @param {string} title 新標籤名稱
 * @param {string} description 新標籤描述
 * @returns {Array} 更新後的標籤數組
 */
function editTag(tags, index, title, description) {
  if (index >= 0 && index < tags.length) {
    tags[index].title = title || tags[index].title;
    tags[index].description = description !== undefined ? description : tags[index].description;
  }
  return tags;
}

module.exports = {
  loadTags,
  saveTags,
  addTag,
  deleteTag,
  editTag,
  resolveTagFilePath,
};
