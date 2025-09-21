/**
 * バックグラウンドスクリプトのメインエントリーポイント
 */

import { createContextMenus, setupContextMenuClickHandler } from './contextMenuHandler.js';
import { setupMessageHandler } from './messageHandler.js';
import { monitorServiceWorkerHealth, startKeepAlive } from './serviceWorkerManager.js';

// Text Highlighter Background Script
console.log('Text Highlighter バックグラウンドスクリプトが読み込まれました');

// 初期化処理
const initialize = () => {
    // Service Worker起動時に keep alive を開始
    startKeepAlive();
    monitorServiceWorkerHealth();
    
    // メッセージハンドラーを設定
    setupMessageHandler();
    
    // コンテキストメニューのクリックハンドラーを設定
    setupContextMenuClickHandler();
    
    console.log('バックグラウンドスクリプト初期化完了');
};

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Text Highlighter がインストールされました');
    
    // 右クリックメニューを作成
    createContextMenus();
});

// 初期化実行
initialize();
