/**
 * コンテキストメニュー処理モジュール
 */

import { CONSTANTS } from '../shared/constants.js';

/**
 * 拡張機能の右クリックコンテキストメニューを作成する
 */
export const createContextMenus = () => {
    // 既存のメニューをクリア
    chrome.contextMenus.removeAll(() => {
        // ハイライト追加メニューを作成
        chrome.contextMenus.create({
            id: "addHighlight",
            title: "ハイライトを追加",
            contexts: ["selection"],
            documentUrlPatterns: ["<all_urls>"]
        });
        
        console.log('右クリックメニューを作成しました');
    });
};

/**
 * 現在設定されているハイライト色をストレージから取得する
 * @returns {Promise<string>} ハイライト色（16進数カラーコード）
 */
const getCurrentHighlightColorFromStorage = async () => {
    try {
        const result = await chrome.storage.sync.get([CONSTANTS.STORAGE_KEYS.CURRENT_HIGHLIGHT_COLOR]);
        const color = result[CONSTANTS.STORAGE_KEYS.CURRENT_HIGHLIGHT_COLOR] || CONSTANTS.DEFAULT_HIGHLIGHT_COLOR;
        return color;
    } catch (error) {
        console.error('現在のハイライト色取得エラー:', error);
        return CONSTANTS.DEFAULT_HIGHLIGHT_COLOR;
    }
};

/**
 * 右クリックメニューのクリック処理を設定する
 */
export const setupContextMenuClickHandler = () => {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        console.log('右クリックメニューがクリックされました:', info.menuItemId);
        
        if (info.menuItemId === "addHighlight") {
            // 現在選択中の色を取得してコンテンツスクリプトにハイライト追加を指示
            getCurrentHighlightColorFromStorage().then(color => {
                chrome.tabs.sendMessage(tab.id, {
                    action: CONSTANTS.MESSAGE_ACTIONS.ADD_HIGHLIGHT_FROM_CONTEXT,
                    selectedText: info.selectionText,
                    color: color
                });
            });
        }
    });
};
