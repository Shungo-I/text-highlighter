/**
 * ハイライト管理モジュール
 */

import { CONSTANTS } from '../shared/constants.js';
import {
    generateHighlightId,
    getElementByXPath,
    getRangeFromElement,
    getTextNodes,
    getXPath,
    rangesOverlap
} from '../shared/utils.js';
import { saveHighlightData } from './storageHelper.js';
import {
    clearContextMenuSelection,
    clearSelection,
    findTextInPage,
    getContextMenuSelection,
    getSelectedRange,
    getSelectedText,
    getTextNodesInRange
} from './textSelection.js';

// ハイライトデータ
let highlightData = [];
let currentDomain = '';

/**
 * ハイライトデータを取得する
 * @returns {Array} ハイライトデータ配列
 */
export const getHighlightData = () => {
    return highlightData;
};

/**
 * ハイライトデータを設定する
 * @param {Array} data - 設定するハイライトデータ
 */
export const setHighlightData = (data) => {
    highlightData = data;
};

/**
 * 現在のドメインを設定する
 * @param {string} domain - 現在のドメイン
 */
export const setCurrentDomain = (domain) => {
    currentDomain = domain;
};

/**
 * 選択されたテキストにハイライトを適用する
 * @param {string} color - ハイライトの色（16進数カラーコード）
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
export const applyHighlight = (color) => {
    const selectedRange = getSelectedRange();
    if (!selectedRange) {
        console.log('選択されたテキストがありません');
        return false;
    }

    try {
        // 既存のハイライトを確認し、重複している場合は削除
        removeOverlappingHighlights(selectedRange);
        
        // 改行を含むかチェック
        const selectedTextContent = selectedRange.toString();
        if (selectedTextContent.includes('\n') || selectedTextContent.includes('\r')) {
            console.log('選択範囲に改行が含まれているため、テキストノード単位でハイライトを適用します');
            return applyHighlightToTextNodes(selectedRange, color);
        }
        
        // ハイライト要素を作成
        const highlightSpan = document.createElement('span');
        highlightSpan.className = CONSTANTS.HIGHLIGHT_CLASS;
        highlightSpan.style.backgroundColor = color;
        highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_COLOR, color);
        highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_ID, generateHighlightId());
        
        // 選択範囲をハイライト要素で囲む
        try {
            selectedRange.surroundContents(highlightSpan);
            console.log('ハイライトを適用しました:', color);
            
            // ハイライト情報を保存
            const parentElement = highlightSpan.parentElement;
            if (parentElement) {
                addHighlightInfo(parentElement, getSelectedText(), color, highlightSpan.getAttribute(CONSTANTS.DATA_HIGHLIGHT_ID));
            }
            
            // 選択を解除
            window.getSelection().removeAllRanges();
            clearSelection();
            
            return true;
        } catch (error) {
            // 複雑な選択範囲の場合はテキストノード単位で処理
            console.log('範囲が複雑なため、テキストノード単位でハイライトを適用します');
            return applyHighlightToTextNodes(selectedRange, color);
        }
    } catch (error) {
        console.error('ハイライト適用エラー:', error);
        return false;
    }
};

/**
 * 指定されたテキストでハイライトを適用する
 * @param {string} text - ハイライトを適用するテキスト
 * @param {string} color - ハイライトの色
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
export const applyHighlightToText = (text, color) => {
    try {
        console.log('コンテキストメニューからのハイライト適用:', text, color);
        
        // ページ内で該当テキストを検索
        const range = findTextInPage(text);
        if (range) {
            // 一時的にselectedRangeを設定
            const originalSelectedRange = getSelectedRange();
            const originalSelectedText = getSelectedText();
            
            // 新しい範囲とテキストを設定
            // selectedRange = range;
            // selectedText = text;
            
            // ハイライトを適用
            const success = applyHighlightToRange(range, color);
            
            return success;
        } else {
            console.log('指定されたテキストが見つかりませんでした:', text);
            return false;
        }
    } catch (error) {
        console.error('コンテキストハイライト適用エラー:', error);
        return false;
    }
};

/**
 * 指定された範囲にハイライトを適用する（復元用）
 * @param {Range} range - ハイライトを適用する範囲
 * @param {string} color - ハイライトの色
 * @param {string} [id] - ハイライトのID（未指定の場合は新規生成）
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
export const applyHighlightToRange = (range, color, id = null) => {
    try {
        const highlightId = id || generateHighlightId();
        const highlightSpan = document.createElement('span');
        highlightSpan.className = CONSTANTS.HIGHLIGHT_CLASS;
        highlightSpan.style.backgroundColor = color;
        highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_COLOR, color);
        highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_ID, highlightId);
        
        range.surroundContents(highlightSpan);
        console.log('ハイライトを復元しました:', color, highlightId);
        return true;
    } catch (error) {
        console.error('ハイライト復元適用エラー:', error);
        return false;
    }
};

/**
 * テキストノード単位でハイライトを適用する（改行を避けるため）
 * @param {Range} range - ハイライトを適用する範囲
 * @param {string} color - ハイライトの色
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
const applyHighlightToTextNodes = (range, color) => {
    try {
        // 範囲内のテキストノードを取得
        const textNodes = getTextNodesInRange(range);
        const highlightId = generateHighlightId();
        let highlightApplied = false;
        
        textNodes.forEach((nodeInfo, index) => {
            const { node, startOffset, endOffset } = nodeInfo;
            
            // 改行文字のみの場合はスキップ
            const nodeText = node.textContent.substring(startOffset, endOffset);
            if (!nodeText.trim() || nodeText === '\n' || nodeText === '\r' || nodeText === '\r\n') {
                return;
            }
            
            // ハイライト用の範囲を作成
            const nodeRange = document.createRange();
            nodeRange.setStart(node, startOffset);
            nodeRange.setEnd(node, endOffset);
            
            // ハイライト要素を作成
            const highlightSpan = document.createElement('span');
            highlightSpan.className = CONSTANTS.HIGHLIGHT_CLASS;
            highlightSpan.style.backgroundColor = color;
            highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_COLOR, color);
            highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_ID, highlightId);
            
            try {
                nodeRange.surroundContents(highlightSpan);
                
                // ハイライト情報を保存（最初のハイライトのみ）
                if (!highlightApplied) {
                    const parentElement = highlightSpan.parentElement;
                    if (parentElement) {
                        addHighlightInfo(parentElement, nodeText, color, highlightId);
                    }
                    highlightApplied = true;
                }
            } catch (error) {
                console.error('テキストノードハイライト適用エラー:', error);
            }
        });
        
        // 選択を解除
        window.getSelection().removeAllRanges();
        clearSelection();
        
        return highlightApplied;
    } catch (error) {
        console.error('テキストノード単位ハイライト適用エラー:', error);
        return false;
    }
};

/**
 * 指定された範囲と重複するハイライトを削除する
 * @param {Range} range - チェックする範囲
 */
const removeOverlappingHighlights = (range) => {
    const highlights = document.querySelectorAll(`.${CONSTANTS.HIGHLIGHT_CLASS}`);
    
    highlights.forEach(highlight => {
        // 範囲の重複を確認
        if (rangesOverlap(range, getRangeFromElement(highlight))) {
            // ハイライトを削除して元のテキストに戻す
            const parent = highlight.parentNode;
            parent.insertBefore(document.createTextNode(highlight.textContent), highlight);
            parent.removeChild(highlight);
            
            // テキストノードを統合
            parent.normalize();
        }
    });
};

/**
 * 指定されたハイライト要素を削除する
 * @param {Element} targetElement - 削除するハイライト要素
 * @returns {boolean} 削除が成功した場合はtrue
 */
export const removeHighlight = (targetElement) => {
    if (!targetElement || !targetElement.classList.contains(CONSTANTS.HIGHLIGHT_CLASS)) {
        console.log('削除対象のハイライトが見つかりません');
        return false;
    }

    try {
        const parent = targetElement.parentNode;
        const textContent = targetElement.textContent;
        const highlightId = targetElement.getAttribute(CONSTANTS.DATA_HIGHLIGHT_ID);
        
        // ハイライト要素を削除してテキストノードに置き換え
        parent.insertBefore(document.createTextNode(textContent), targetElement);
        parent.removeChild(targetElement);
        
        // テキストノードを統合
        parent.normalize();
        
        // ハイライト情報を削除
        if (highlightId) {
            removeHighlightInfo(highlightId);
        }
        
        console.log('ハイライトを削除しました');
        return true;
    } catch (error) {
        console.error('ハイライト削除エラー:', error);
        return false;
    }
};

/**
 * クリックされた要素またはその親要素がハイライト要素かチェックする
 * @param {Element} element - チェックする要素
 * @returns {Element|null} ハイライト要素が見つかった場合はその要素、見つからない場合はnull
 */
export const findHighlightElement = (element) => {
    // 5レベルまで親要素を辿ってハイライト要素を探す
    let current = element;
    let depth = 0;
    
    while (current && depth < CONSTANTS.LIMITS.HIGHLIGHT_ELEMENT_SEARCH_DEPTH) {
        if (current.classList && current.classList.contains(CONSTANTS.HIGHLIGHT_CLASS)) {
            return current;
        }
        current = current.parentElement;
        depth++;
    }
    
    return null;
};

/**
 * ハイライト情報を配列に追加し、ストレージに保存する
 * @param {Element} element - ハイライトが適用された要素の親要素
 * @param {string} text - ハイライトされたテキスト
 * @param {string} color - ハイライトの色
 * @param {string} id - ハイライトのID
 */
const addHighlightInfo = (element, text, color, id) => {
    const xpath = getXPath(element);
    if (xpath) {
        const highlightInfo = {
            id: id,
            xpath: xpath,
            text: text,
            color: color,
            timestamp: Date.now()
        };
        
        // 既存の同じIDのハイライトを削除
        highlightData = highlightData.filter(item => item.id !== id);
        
        // 新しいハイライト情報を追加
        highlightData.push(highlightInfo);
        
        // データを保存
        saveHighlightData(highlightData, currentDomain);
    }
};

/**
 * 指定されたIDのハイライト情報を配列から削除し、ストレージを更新する
 * @param {string} id - 削除するハイライトのID
 */
const removeHighlightInfo = (id) => {
    const originalLength = highlightData.length;
    highlightData = highlightData.filter(item => item.id !== id);
    
    if (highlightData.length !== originalLength) {
        saveHighlightData(highlightData, currentDomain);
        console.log('ハイライト情報を削除しました:', id);
    }
};

/**
 * 保存されたハイライト情報を元にページ上のハイライトを復元する
 */
export const restoreHighlights = () => {
    highlightData.forEach(highlightInfo => {
        try {
            const element = getElementByXPath(highlightInfo.xpath);
            if (element) {
                // テキスト内容を確認
                const textContent = element.textContent;
                const targetText = highlightInfo.text;
                const startIndex = textContent.indexOf(targetText);
                
                if (startIndex !== -1) {
                    // テキストノードを探してハイライトを適用
                    const textNodes = getTextNodes(element);
                    let currentIndex = 0;
                    
                    for (let textNode of textNodes) {
                        const nodeText = textNode.textContent;
                        const nodeEnd = currentIndex + nodeText.length;
                        
                        if (startIndex >= currentIndex && startIndex < nodeEnd) {
                            const nodeStartIndex = startIndex - currentIndex;
                            const nodeEndIndex = Math.min(
                                nodeStartIndex + targetText.length,
                                nodeText.length
                            );
                            
                            // 範囲を作成してハイライトを適用
                            const range = document.createRange();
                            range.setStart(textNode, nodeStartIndex);
                            range.setEnd(textNode, nodeEndIndex);
                            
                            applyHighlightToRange(range, highlightInfo.color, highlightInfo.id);
                            break;
                        }
                        
                        currentIndex = nodeEnd;
                    }
                }
            }
        } catch (error) {
            console.error('ハイライト復元エラー:', error);
        }
    });
};

/**
 * コンテキストメニューからのハイライト処理
 * @param {string} color - ハイライト色
 * @param {string} [selectedText] - 選択されたテキスト（フォールバック用）
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
export const handleContextMenuHighlight = (color, selectedText = null) => {
    const contextSelection = getContextMenuSelection();
    const now = Date.now();
    
    // 保存された選択情報を使用（5秒以内の場合）
    if (contextSelection.range && 
        contextSelection.timestamp && 
        (now - contextSelection.timestamp) < CONSTANTS.TIMEOUTS.CONTEXT_MENU_SELECTION) {
        
        console.log('保存された選択情報を使用してハイライト適用:', contextSelection.text);
        
        const success = applyHighlightToRange(contextSelection.range, color);
        
        // 使用済みの選択情報をクリア
        clearContextMenuSelection();
        
        return success;
    } else {
        // フォールバック: テキスト検索方式
        if (selectedText && selectedText.trim()) {
            return applyHighlightToText(selectedText, color);
        } else {
            console.log('ハイライト適用失敗: 選択情報が見つかりません');
            return false;
        }
    }
};

/**
 * ハイライト要素のダブルクリック処理を設定する
 */
export const setupHighlightEventListeners = () => {
    // ハイライト要素のダブルクリック処理（削除）
    document.addEventListener('dblclick', (event) => {
        const highlightElement = findHighlightElement(event.target);
        if (highlightElement) {
            event.preventDefault();
            event.stopPropagation();
            
            // 確認なしで即座に削除
            const success = removeHighlight(highlightElement);
            if (success) {
                console.log('ダブルクリックでハイライトを削除しました');
            }
        }
    });
};
