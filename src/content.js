// グローバル変数
let selectedText = '';
let selectedRange = null;
let currentDomain = '';
let highlightData = [];

// 拡張機能の状態チェック
let extensionValid = true;

// 拡張機能コンテキストの有効性をチェック
function checkExtensionContext() {
    try {
        // chromeオブジェクトが存在するかチェック
        if (!chrome || !chrome.runtime) {
            extensionValid = false;
            return false;
        }
        
        // chrome.runtime.id にアクセスしてコンテキストをテスト
        const testId = chrome.runtime.id;
        if (testId === undefined || testId === null) {
            extensionValid = false;
            return false;
        }
        
        // ランタイムURLが有効かチェック
        try {
            const testUrl = chrome.runtime.getURL('manifest.json');
            if (!testUrl || !testUrl.startsWith('chrome-extension://')) {
                extensionValid = false;
                return false;
            }
        } catch (urlError) {
            extensionValid = false;
            return false;
        }
        
        extensionValid = true;
        return true;
    } catch (error) {
        extensionValid = false;
        console.log('拡張機能コンテキストが無効です:', error.message);
        return false;
    }
}

// コンテキストメニュー用の選択情報保存
let contextMenuSelection = {
    text: '',
    range: null,
    timestamp: null
};

// デフォルトのハイライト色
const DEFAULT_HIGHLIGHT_COLOR = '#ffff00'; // 黄色

// Service Workerとの安全なメッセージ通信関数
async function sendMessageSafely(message, maxRetries = 2) {
    // 拡張機能のコンテキストが有効かチェック
    if (!checkExtensionContext()) {
        console.log('拡張機能のコンテキストが無効なため、メッセージ送信をスキップします');
        return null;
    }

    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
        try {
            // Service Workerが起動するまで少し待つ
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            }
            
            const response = await chrome.runtime.sendMessage(message);
            return response;
        } catch (error) {
            retryCount++;
            
            // Service Workerが非アクティブまたはコンテキストが無効な場合
            if (error.message.includes('Extension context invalidated') || 
                error.message.includes('Could not establish connection') ||
                error.message.includes('receiving end does not exist') ||
                error.message.includes('Receiving end does not exist')) {
                
                console.log(`メッセージ送信試行 ${retryCount}/${maxRetries + 1} 失敗:`, error.message);
                
                // 最後の試行でも失敗した場合
                if (retryCount > maxRetries) {
                    console.log('拡張機能との接続に失敗しました。メッセージ送信をスキップします。');
                    return null;
                }
                
                // リトライを続行
                continue;
            }
            
            // その他のエラーの場合は即座に失敗
            console.error('予期しないメッセージ送信エラー:', error);
            return null;
        }
    }
    
    return null;
}


// テキスト選択を監視
document.addEventListener('mouseup', function(event) {
    handleTextSelection();
});

document.addEventListener('keyup', function(event) {
    // キーボードでの選択も監視
    handleTextSelection();
});

function handleTextSelection() {
    // 拡張機能のコンテキストが無効な場合は何もしない
    if (!extensionValid) {
        return;
    }
    
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        selectedText = selection.toString().trim();
        selectedRange = selection.getRangeAt(0).cloneRange();
        
        console.log('テキストが選択されました:', selectedText);
        
        // 選択情報をストレージに保存（ポップアップで使用）
        sendMessageSafely({
            action: 'textSelected',
            text: selectedText,
            length: selectedText.length
        });
    } else {
        selectedText = '';
        selectedRange = null;
        
        // 選択解除をポップアップに通知
        sendMessageSafely({
            action: 'textDeselected'
        });
    }
}

// 指定されたテキストでハイライトを適用する関数
function applyHighlightToText(text, color) {
    try {
        console.log('コンテキストメニューからのハイライト適用:', text, color);
        
        // ページ内で該当テキストを検索
        const range = findTextInPage(text);
        if (range) {
            // 一時的にselectedRangeを設定
            const originalSelectedRange = selectedRange;
            const originalSelectedText = selectedText;
            
            selectedRange = range;
            selectedText = text;
            
            // ハイライトを適用
            const success = applyHighlight(color);
            
            // 元の状態に戻す
            selectedRange = originalSelectedRange;
            selectedText = originalSelectedText;
            
            return success;
        } else {
            console.log('指定されたテキストが見つかりませんでした:', text);
            return false;
        }
    } catch (error) {
        console.error('コンテキストハイライト適用エラー:', error);
        return false;
    }
}

// ページ内でテキストを検索して範囲を取得
function findTextInPage(searchText) {
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
}

// ハイライト適用関数
function applyHighlight(color) {
    if (!selectedRange) {
        console.log('選択されたテキストがありません');
        return false;
    }

    try {
        // 既存のハイライトを確認し、重複している場合は削除
        removeOverlappingHighlights(selectedRange);
        
        // ハイライト要素を作成
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'text-highlighter-highlight';
        highlightSpan.style.backgroundColor = color;
        highlightSpan.setAttribute('data-highlight-color', color);
        highlightSpan.setAttribute('data-highlight-id', generateHighlightId());
        
        // 選択範囲をハイライト要素で囲む
        try {
            selectedRange.surroundContents(highlightSpan);
            console.log('ハイライトを適用しました:', color);
            
            // ハイライト情報を保存
            const parentElement = highlightSpan.parentElement;
            if (parentElement) {
                addHighlightInfo(parentElement, selectedText, color, highlightSpan.getAttribute('data-highlight-id'));
            }
            
            // 選択を解除
            window.getSelection().removeAllRanges();
            selectedRange = null;
            selectedText = '';
            
            return true;
        } catch (error) {
            // 複雑な選択範囲の場合の代替処理
            console.log('範囲が複雑なため、extractContents方式を使用します');
            
            const contents = selectedRange.extractContents();
            highlightSpan.appendChild(contents);
            selectedRange.insertNode(highlightSpan);
            
            // ハイライト情報を保存
            const parentElement = highlightSpan.parentElement;
            if (parentElement) {
                addHighlightInfo(parentElement, selectedText, color, highlightSpan.getAttribute('data-highlight-id'));
            }
            
            // 選択を解除
            window.getSelection().removeAllRanges();
            selectedRange = null;
            selectedText = '';
            
            return true;
        }
    } catch (error) {
        console.error('ハイライト適用エラー:', error);
        return false;
    }
}

// 重複するハイライトを削除
function removeOverlappingHighlights(range) {
    const highlights = document.querySelectorAll('.text-highlighter-highlight');
    
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
}

// 要素から範囲を取得
function getRangeFromElement(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range;
}

// 範囲の重複をチェック
function rangesOverlap(range1, range2) {
    try {
        return range1.compareBoundaryPoints(Range.START_TO_END, range2) > 0 &&
               range2.compareBoundaryPoints(Range.START_TO_END, range1) > 0;
    } catch (error) {
        return false;
    }
}

// ハイライトIDを生成
function generateHighlightId() {
    return 'highlight_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ハイライト削除関数
function removeHighlight(targetElement) {
    if (!targetElement || !targetElement.classList.contains('text-highlighter-highlight')) {
        console.log('削除対象のハイライトが見つかりません');
        return false;
    }

    try {
        const parent = targetElement.parentNode;
        const textContent = targetElement.textContent;
        const highlightId = targetElement.getAttribute('data-highlight-id');
        
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
}

// クリックされた要素がハイライトかチェック
function findHighlightElement(element) {
    // 5レベルまで親要素を辿ってハイライト要素を探す
    let current = element;
    let depth = 0;
    
    while (current && depth < 5) {
        if (current.classList && current.classList.contains('text-highlighter-highlight')) {
            return current;
        }
        current = current.parentElement;
        depth++;
    }
    
    return null;
}

// 右クリック時の処理
document.addEventListener('contextmenu', function(event) {
    // 現在の選択情報をコンテキストメニュー用に保存
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        contextMenuSelection.text = selection.toString().trim();
        contextMenuSelection.range = selection.getRangeAt(0).cloneRange();
        contextMenuSelection.timestamp = Date.now();
        console.log('コンテキストメニュー用選択情報を保存:', contextMenuSelection.text);
    }
    
    const highlightElement = findHighlightElement(event.target);
    
    if (highlightElement) {
        console.log('ハイライト要素で右クリック検出');
        // 削除対象として視覚的にマーク
        highlightElement.classList.add('deletion-target');
        
        // 2秒後にマークを除去
        setTimeout(() => {
            if (highlightElement.parentNode) {
                highlightElement.classList.remove('deletion-target');
            }
        }, 2000);
    }
});

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'applyHighlight') {
        if (!selectedText) {
            // テキストが選択されていない場合は失敗として返す
            sendResponse({success: false});
        } else {
            const success = applyHighlight(request.color);
            sendResponse({success: success});
        }
    } else if (request.action === 'addHighlightFromContext') {
        // コンテキストメニューからのハイライト追加
        const color = request.color || DEFAULT_HIGHLIGHT_COLOR;
        
        // 保存された選択情報を使用（5秒以内の場合）
        const now = Date.now();
        if (contextMenuSelection.range && 
            contextMenuSelection.timestamp && 
            (now - contextMenuSelection.timestamp) < 5000) {
            
            console.log('保存された選択情報を使用してハイライト適用:', contextMenuSelection.text);
            
            // 保存された選択情報を使用
            const originalSelectedRange = selectedRange;
            const originalSelectedText = selectedText;
            
            selectedRange = contextMenuSelection.range;
            selectedText = contextMenuSelection.text;
            
            const success = applyHighlight(color);
            
            // 元の状態に戻す
            selectedRange = originalSelectedRange;
            selectedText = originalSelectedText;
            
            // 使用済みの選択情報をクリア
            contextMenuSelection = {
                text: '',
                range: null,
                timestamp: null
            };
            
            sendResponse({success: success});
        } else {
            // フォールバック: テキスト検索方式
            const contextText = request.selectedText;
            if (contextText && contextText.trim()) {
                const success = applyHighlightToText(contextText, color);
                sendResponse({success: success});
            } else {
                console.log('ハイライト適用失敗: 選択情報が見つかりません');
                sendResponse({success: false});
            }
        }
    } else if (request.action === 'getSelectedText') {
        sendResponse({
            text: selectedText,
            hasSelection: selectedText.length > 0
        });
    } else if (request.action === 'removeHighlight') {
        // 現在選択されている範囲内のハイライトを削除
        const selection = window.getSelection();
        let removed = false;
        
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            
            // 選択範囲内のハイライト要素を探す
            let highlights = [];
            
            if (container.nodeType === Node.ELEMENT_NODE) {
                highlights = container.querySelectorAll('.text-highlighter-highlight');
            } else if (container.parentElement) {
                highlights = container.parentElement.querySelectorAll('.text-highlighter-highlight');
            }
            
            // 選択範囲と重複するハイライトを削除
            highlights.forEach(highlight => {
                const highlightRange = getRangeFromElement(highlight);
                if (rangesOverlap(range, highlightRange)) {
                    removeHighlight(highlight);
                    removed = true;
                }
            });
        } else {
            // 選択がない場合、右クリック位置の要素を確認
            const elements = document.elementsFromPoint(
                event.clientX || 0, 
                event.clientY || 0
            );
            
            for (let element of elements) {
                const highlightElement = findHighlightElement(element);
                if (highlightElement) {
                    removeHighlight(highlightElement);
                    removed = true;
                    break;
                }
            }
        }
        
        sendResponse({success: removed});
    }
    
    return true; // 非同期レスポンスを示す
});

// データ永続化関数
function getCurrentDomain() {
    return window.location.hostname;
}

function getStorageKey() {
    return `highlights_${currentDomain}`;
}

// ハイライト情報をXPathで保存
function getXPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }
    
    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }
    
    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = element.previousSibling;
        
        while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && 
                sibling.tagName === element.tagName) {
                index++;
            }
            sibling = sibling.previousSibling;
        }
        
        const tagName = element.tagName.toLowerCase();
        parts.unshift(`${tagName}[${index}]`);
        element = element.parentElement;
    }
    
    return `/${parts.join('/')}`;
}

// XPathから要素を取得
function getElementByXPath(xpath) {
    try {
        const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        return result.singleNodeValue;
    } catch (error) {
        console.error('XPath評価エラー:', error);
        return null;
    }
}

// ハイライト情報を保存
async function saveHighlightData() {
    try {
        const key = getStorageKey();
        const data = {
            domain: currentDomain,
            url: window.location.href,
            highlights: highlightData,
            lastUpdated: Date.now()
        };
        
        const response = await sendMessageSafely({
            action: 'saveToStorage',
            key: key,
            data: data
        });
        
        if (response && response.success) {
            console.log('ハイライトデータを保存しました:', key, data);
        } else {
            console.error('ハイライトデータ保存エラー:', response?.error);
        }
    } catch (error) {
        console.error('ハイライトデータ保存エラー:', error);
    }
}

// ハイライト情報を読み込み
async function loadHighlightData() {
    try {
        const key = getStorageKey();
        const response = await sendMessageSafely({
            action: 'loadFromStorage',
            key: key
        });
        
        if (response && response.success && response.data) {
            const data = response.data;
            highlightData = data.highlights || [];
            console.log('ハイライトデータを読み込みました:', key, data);
            
            // 保存されたハイライトを復元
            restoreHighlights();
        } else {
            highlightData = [];
            console.log('保存されたハイライトデータはありません');
        }
    } catch (error) {
        console.error('ハイライトデータ読み込みエラー:', error);
        highlightData = [];
    }
}

// ハイライトを復元
function restoreHighlights() {
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
}

// 要素内のテキストノードを取得
function getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
            textNodes.push(node);
        }
    }
    
    return textNodes;
}

// 範囲にハイライトを適用（復元用）
function applyHighlightToRange(range, color, id) {
    try {
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'text-highlighter-highlight';
        highlightSpan.style.backgroundColor = color;
        highlightSpan.setAttribute('data-highlight-color', color);
        highlightSpan.setAttribute('data-highlight-id', id);
        
        range.surroundContents(highlightSpan);
        console.log('ハイライトを復元しました:', color, id);
    } catch (error) {
        console.error('ハイライト復元適用エラー:', error);
    }
}

// ハイライト情報を追加
function addHighlightInfo(element, text, color, id) {
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
        saveHighlightData();
    }
}

// ハイライト情報を削除
function removeHighlightInfo(id) {
    const originalLength = highlightData.length;
    highlightData = highlightData.filter(item => item.id !== id);
    
    if (highlightData.length !== originalLength) {
        saveHighlightData();
        console.log('ハイライト情報を削除しました:', id);
    }
}

// ページ読み込み完了時の処理
document.addEventListener('DOMContentLoaded', function() {
    console.log('Text Highlighter: DOMコンテンツ読み込み完了');
    
    // 拡張機能のコンテキストをチェック
    if (!checkExtensionContext()) {
        console.log('拡張機能のコンテキストが無効なため、初期化をスキップします');
        return;
    }
    
    // ドメインを設定
    currentDomain = getCurrentDomain();
    console.log('現在のドメイン:', currentDomain);
    
    // 保存されたハイライトを読み込み
    loadHighlightData();
});

// ページ離脱時にデータを保存
window.addEventListener('beforeunload', function() {
    saveHighlightData();
});
