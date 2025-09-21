/**
 * テキスト選択処理モジュール
 */

import { CONSTANTS } from '../shared/constants.js';
import { isExtensionValid, sendMessageSafely } from './extensionContext.js';

// グローバル変数
let selectedText = '';
let selectedRange = null;

// コンテキストメニュー用の選択情報保存
let contextMenuSelection = {
    text: '',
    range: null,
    timestamp: null
};

/**
 * 現在選択されているテキストを取得する
 * @returns {string} 選択されたテキスト
 */
export const getSelectedText = () => {
    return selectedText;
};

/**
 * 現在選択されている範囲を取得する
 * @returns {Range|null} 選択された範囲
 */
export const getSelectedRange = () => {
    return selectedRange;
};

/**
 * コンテキストメニュー用の選択情報を取得する
 * @returns {Object} コンテキストメニュー選択情報
 */
export const getContextMenuSelection = () => {
    return contextMenuSelection;
};

/**
 * 選択状態をクリアする
 */
export const clearSelection = () => {
    selectedText = '';
    selectedRange = null;
};

/**
 * コンテキストメニュー選択情報をクリアする
 */
export const clearContextMenuSelection = () => {
    contextMenuSelection = {
        text: '',
        range: null,
        timestamp: null
    };
};

/**
 * テキスト選択のハンドリングを行う
 * 選択されたテキストと範囲を保存し、Service Workerに通知する
 */
export const handleTextSelection = () => {
    // 拡張機能のコンテキストが無効な場合は何もしない
    if (!isExtensionValid()) {
        return;
    }
    
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        selectedText = selection.toString().trim();
        selectedRange = selection.getRangeAt(0).cloneRange();
        
        console.log('テキストが選択されました:', selectedText);
        
        // 選択情報をストレージに保存（ポップアップで使用）
        sendMessageSafely({
            action: CONSTANTS.MESSAGE_ACTIONS.TEXT_SELECTED,
            text: selectedText,
            length: selectedText.length
        });
    } else {
        selectedText = '';
        selectedRange = null;
        
        // 選択解除をポップアップに通知
        sendMessageSafely({
            action: CONSTANTS.MESSAGE_ACTIONS.TEXT_DESELECTED
        });
    }
};

/**
 * ページ内で指定されたテキストを検索して範囲を取得する
 * @param {string} searchText - 検索するテキスト
 * @returns {Range|null} 見つかった場合はRange オブジェクト、見つからない場合はnull
 */
export const findTextInPage = (searchText) => {
    try {
        // TreeWalkerを使用してテキストノードを検索
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            const nodeText = node.textContent;
            const index = nodeText.indexOf(searchText);
            
            if (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + searchText.length);
                return range;
            }
        }
        
        return null;
    } catch (error) {
        console.error('テキスト検索エラー:', error);
        return null;
    }
};

/**
 * 指定された範囲内のテキストノードとその範囲情報を取得する
 * @param {Range} range - 検索範囲
 * @returns {Array} テキストノード情報の配列
 */
export const getTextNodesInRange = (range) => {
    const textNodes = [];
    const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // 範囲内にあるテキストノードのみを受け入れ
                const nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);
                return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        },
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        // ノード内での開始・終了位置を計算
        let startOffset = 0;
        let endOffset = node.textContent.length;
        
        // より正確な範囲計算
        try {
            if (range.startContainer === node) {
                startOffset = range.startOffset;
            } else if (range.comparePoint && range.comparePoint(node, 0) <= 0) {
                startOffset = 0;
            } else if (range.startContainer.contains && range.startContainer.contains(node)) {
                startOffset = 0;
            }
            
            if (range.endContainer === node) {
                endOffset = range.endOffset;
            } else if (range.comparePoint && range.comparePoint(node, node.textContent.length) >= 0) {
                endOffset = node.textContent.length;
            } else if (range.endContainer.contains && range.endContainer.contains(node)) {
                endOffset = node.textContent.length;
            }
        } catch (error) {
            // フォールバック処理
            if (range.startContainer === node) {
                startOffset = range.startOffset;
            }
            if (range.endContainer === node) {
                endOffset = range.endOffset;
            }
        }
        
        // 有効な範囲がある場合のみ追加
        if (startOffset < endOffset) {
            textNodes.push({
                node: node,
                startOffset: startOffset,
                endOffset: endOffset
            });
        }
    }
    
    return textNodes;
};

/**
 * 右クリック時の選択情報を保存する
 */
export const handleContextMenu = () => {
    // 現在の選択情報をコンテキストメニュー用に保存
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        contextMenuSelection.text = selection.toString().trim();
        contextMenuSelection.range = selection.getRangeAt(0).cloneRange();
        contextMenuSelection.timestamp = Date.now();
        console.log('コンテキストメニュー用選択情報を保存:', contextMenuSelection.text);
    }
};

/**
 * テキスト選択イベントリスナーを設定する
 */
export const setupTextSelectionListeners = () => {
    // テキスト選択を監視
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);
    
    // 右クリック時の処理
    document.addEventListener('contextmenu', handleContextMenu);
};
