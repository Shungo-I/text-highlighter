/**
 * コンテンツスクリプトのメインエントリーポイント
 */

import { CONSTANTS } from '../shared/constants.js';
import { getCurrentDomain } from '../shared/utils.js';
import { checkExtensionContext } from './extensionContext.js';
import {
    applyHighlight,
    getHighlightData,
    handleContextMenuHighlight,
    restoreHighlights,
    setCurrentDomain,
    setHighlightData,
    setupHighlightEventListeners
} from './highlightManager.js';
import { loadHighlightData, saveHighlightData } from './storageHelper.js';
import { getSelectedText, setupTextSelectionListeners } from './textSelection.js';

// 初期化処理
const initialize = async () => {
    console.log('Text Highlighter: コンテンツスクリプト初期化開始');
    
    // 拡張機能のコンテキストをチェック
    if (!checkExtensionContext()) {
        console.log('拡張機能のコンテキストが無効なため、初期化をスキップします');
        return;
    }
    
    // ドメインを設定
    const currentDomain = getCurrentDomain();
    setCurrentDomain(currentDomain);
    console.log('現在のドメイン:', currentDomain);
    
    // ドメインが取得できない場合のエラーハンドリング
    if (!currentDomain) {
        console.error('ドメインの取得に失敗しました:', window.location);
        setCurrentDomain('unknown_domain');
    }
    
    // 保存されたハイライトを読み込み
    try {
        const highlightData = await loadHighlightData(currentDomain);
        setHighlightData(highlightData);
        
        // 保存されたハイライトを復元
        restoreHighlights();
    } catch (error) {
        console.error('ハイライトデータ読み込みエラー:', error);
    }
    
    // イベントリスナーを設定
    setupTextSelectionListeners();
    setupHighlightEventListeners();
    
    console.log('Text Highlighter: 初期化完了');
};

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === CONSTANTS.MESSAGE_ACTIONS.APPLY_HIGHLIGHT) {
            const selectedText = getSelectedText();
            if (!selectedText) {
                // テキストが選択されていない場合は失敗として返す
                sendResponse({success: false});
            } else {
                const success = applyHighlight(request.color);
                sendResponse({success: success});
            }
        } else if (request.action === CONSTANTS.MESSAGE_ACTIONS.ADD_HIGHLIGHT_FROM_CONTEXT) {
            // コンテキストメニューからのハイライト追加
            const color = request.color || CONSTANTS.DEFAULT_HIGHLIGHT_COLOR;
            const success = handleContextMenuHighlight(color, request.selectedText);
            sendResponse({success: success});
        } else if (request.action === CONSTANTS.MESSAGE_ACTIONS.GET_SELECTED_TEXT) {
            sendResponse({
                text: getSelectedText(),
                hasSelection: getSelectedText().length > 0
            });
        }
    } catch (error) {
        console.error('メッセージ処理エラー:', error);
        sendResponse({success: false, error: error.message});
    }
    
    return true; // 非同期レスポンスを示す
});

// ページ読み込み完了時の処理
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // 既に読み込み済みの場合は即座に初期化
    initialize();
}

// ページ離脱時にデータを保存
window.addEventListener('beforeunload', () => {
    const highlightData = getHighlightData();
    const currentDomain = getCurrentDomain();
    saveHighlightData(highlightData, currentDomain);
});
