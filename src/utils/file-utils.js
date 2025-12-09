/**
 * 文件工具函數
 */

const fs = require('fs');
const path = require('path');

/**
 * 獲取標籤文件路徑
 * @param {string} videoPath 影片文件路徑
 * @returns {string} 標籤文件路徑
 */
function getTagFilePath(videoPath) {
  return `${videoPath}.json`;
}

/**
 * 檢查文件是否存在
 * @param {string} filePath 文件路徑
 * @returns {boolean}
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 讀取文件內容
 * @param {string} filePath 文件路徑
 * @returns {string} 文件內容
 */
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 寫入文件內容
 * @param {string} filePath 文件路徑
 * @param {string} content 內容
 */
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 獲取文件名（不含路徑）
 * @param {string} filePath 文件路徑
 * @returns {string} 文件名
 */
function getFileName(filePath) {
  return path.basename(filePath);
}

/**
 * 獲取文件目錄
 * @param {string} filePath 文件路徑
 * @returns {string} 目錄路徑
 */
function getDirectory(filePath) {
  return path.dirname(filePath);
}

module.exports = {
  getTagFilePath,
  fileExists,
  readFile,
  writeFile,
  getFileName,
  getDirectory,
};
