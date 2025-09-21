/**
 * コンテンツスクリプト用バンドルファイル
 * ES6モジュールをサポートしないコンテンツスクリプトのため、
 * 全ての機能を1つのファイルにまとめています。
 */

// ===== 共通定数定義 =====
const CONSTANTS = {
    // デフォルトハイライト色
    DEFAULT_HIGHLIGHT_COLOR: '#ffff00',
    
    // ハイライト要素のクラス名
    HIGHLIGHT_CLASS: 'text-highlighter-highlight',
    
    // データ属性名
    DATA_HIGHLIGHT_COLOR: 'data-highlight-color',
    DATA_HIGHLIGHT_ID: 'data-highlight-id',
    
    // ストレージキー
    STORAGE_KEYS: {
        CURRENT_HIGHLIGHT_COLOR: 'current_highlight_color',
        CURRENT_COLOR_NAME: 'current_color_name',
        CUSTOM_COLORS: 'custom_colors'
    },
    
    // メッセージアクション
    MESSAGE_ACTIONS: {
        PING: 'ping',
        TEXT_SELECTED: 'textSelected',
        TEXT_DESELECTED: 'textDeselected',
        APPLY_HIGHLIGHT: 'applyHighlight',
        ADD_HIGHLIGHT_FROM_CONTEXT: 'addHighlightFromContext',
        GET_SELECTED_TEXT: 'getSelectedText',
        SAVE_TO_STORAGE: 'saveToStorage',
        LOAD_FROM_STORAGE: 'loadFromStorage'
    },
    
    // タイムアウト設定
    TIMEOUTS: {
        CONTEXT_MENU_SELECTION: 5000, // 5秒
        SERVICE_WORKER_RETRY: 2000, // 2秒
        STATUS_MESSAGE_DISPLAY: 3000 // 3秒
    },
    
    // 制限値
    LIMITS: {
        MAX_CUSTOM_COLORS: 8,
        MAX_COLOR_NAME_LENGTH: 10,
        MAX_RETRIES: 3,
        HIGHLIGHT_ELEMENT_SEARCH_DEPTH: 5
    }
};

// ===== 共通ユーティリティ関数 =====

/**
 * ハイライト用のユニークなIDを生成する
 * @returns {string} 生成されたハイライトID
 */
const generateHighlightId = () => {
    return 'highlight_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * 要素のXPathを取得する
 * @param {Element} element - XPathを取得する要素
 * @returns {string|null} XPath文字列、取得できない場合はnull
 */
const getXPath = (element) => {
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
};

/**
 * XPathから要素を取得する
 * @param {string} xpath - XPath文字列
 * @returns {Element|null} 見つかった要素、見つからない場合はnull
 */
const getElementByXPath = (xpath) => {
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
};

/**
 * 要素内のテキストノードを取得する
 * @param {Element} element - 検索対象の要素
 * @returns {Array<Text>} テキストノードの配列
 */
const getTextNodes = (element) => {
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
};

/**
 * 現在のドメインを取得する
 * @returns {string} 現在のページのホスト名
 */
const getCurrentDomain = () => {
    return window.location.hostname;
};

/**
 * 現在のドメイン用のストレージキーを取得する
 * @returns {string} ストレージキー
 */
const getStorageKey = (domain) => {
    return `highlights_${domain}`;
};

/**
 * 二つの範囲が重複しているかチェックする
 * @param {Range} range1 - 最初の範囲
 * @param {Range} range2 - 二番目の範囲
 * @returns {boolean} 範囲が重複している場合はtrue
 */
const rangesOverlap = (range1, range2) => {
    try {
        return range1.compareBoundaryPoints(Range.START_TO_END, range2) > 0 &&
               range2.compareBoundaryPoints(Range.START_TO_END, range1) > 0;
    } catch (error) {
        return false;
    }
};

/**
 * 要素から範囲を取得する
 * @param {Element} element - 範囲を取得する要素
 * @returns {Range} 要素の内容を選択する範囲
 */
const getRangeFromElement = (element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range;
};

// ===== 拡張機能コンテキスト管理 =====

// 拡張機能の状態チェック
let extensionValid = true;

/**
 * 拡張機能のコンテキストが有効かどうかをチェックする
 * @returns {boolean} 拡張機能のコンテキストが有効な場合はtrue、無効な場合はfalse
 */
const checkExtensionContext = () => {
    try {
        // chromeオブジェクトが存在するかチェック
        if (!chrome || !chrome.runtime) {
            extensionValid = false;
            return false;
        }
        
        // chrome.storage が利用可能かチェック
        if (!chrome.storage || !chrome.storage.local) {
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
};

/**
 * 拡張機能の状態を取得する
 * @returns {boolean} 拡張機能が有効な場合はtrue
 */
const isExtensionValid = () => {
    return extensionValid;
};

/**
 * Service Workerの状態を確認する
 * @returns {Promise<boolean>} Service Workerがアクティブな場合はtrue
 */
const checkServiceWorkerStatus = async () => {
    try {
        // 簡単なpingメッセージを送信してService Workerの状態を確認
        const response = await chrome.runtime.sendMessage({ action: 'ping' });
        return response && response.success;
    } catch (error) {
        console.log('Service Worker状態確認失敗:', error.message);
        return false;
    }
};

/**
 * Service Workerとの安全なメッセージ通信を行う
 * 拡張機能のコンテキストが無効な場合やService Workerが非アクティブな場合に適切に処理する
 * @param {Object} message - 送信するメッセージオブジェクト
 * @param {number} [maxRetries=3] - 最大リトライ回数
 * @returns {Promise<Object|null>} Service Workerからの応答、失敗時はnull
 */
const sendMessageSafely = async (message, maxRetries = 3) => {
    // 拡張機能のコンテキストが有効かチェック
    if (!checkExtensionContext()) {
        console.log('拡張機能のコンテキストが無効なため、メッセージ送信をスキップします');
        return null;
    }

    // Service Workerの状態を事前確認
    const isServiceWorkerActive = await checkServiceWorkerStatus();
    if (!isServiceWorkerActive) {
        console.log('Service Workerが非アクティブです。起動を待機中...');
        // Service Workerの起動を待つ
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
        try {
            // Service Workerが起動するまで待機時間を増やす
            if (retryCount > 0) {
                const waitTime = Math.min(200 * Math.pow(2, retryCount - 1), 2000); // 指数バックオフ（最大2秒）
                console.log(`Service Worker起動待機中... (${waitTime}ms)`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            console.log(`メッセージを送信中 (試行 ${retryCount + 1}/${maxRetries + 1}):`, message.action);
            const response = await chrome.runtime.sendMessage(message);
            console.log('メッセージ送信成功:', { action: message.action, response });
            return response;
        } catch (error) {
            retryCount++;
            
            // Service Workerが非アクティブまたはコンテキストが無効な場合
            if (error.message.includes('Extension context invalidated') || 
                error.message.includes('Could not establish connection') ||
                error.message.includes('receiving end does not exist') ||
                error.message.includes('Receiving end does not exist')) {
                
                console.log(`メッセージ送信試行 ${retryCount}/${maxRetries + 1} 失敗:`, {
                    error: error.message,
                    action: message.action
                });
                
                // 最後の試行でも失敗した場合
                if (retryCount > maxRetries) {
                    console.log('拡張機能との接続に失敗しました。メッセージ送信をスキップします。');
                    return null;
                }
                
                // リトライを続行
                continue;
            }
            
            // その他のエラーの場合は即座に失敗
            console.error('予期しないメッセージ送信エラー:', {
                error: error.message,
                action: message.action,
                stack: error.stack
            });
            return null;
        }
    }
    
    return null;
};

// ===== グローバル変数 =====
let selectedText = '';
let selectedRange = null;
let currentDomain = '';
let highlightData = [];

// コンテキストメニュー用の選択情報保存
let contextMenuSelection = {
    text: '',
    range: null,
    timestamp: null
};

// ===== テキスト選択処理 =====

/**
 * テキスト選択のハンドリングを行う
 * 選択されたテキストと範囲を保存し、Service Workerに通知する
 */
const handleTextSelection = () => {
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
const findTextInPage = (searchText) => {
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
const getTextNodesInRange = (range) => {
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
const handleContextMenu = () => {
    // 現在の選択情報をコンテキストメニュー用に保存
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        contextMenuSelection.text = selection.toString().trim();
        contextMenuSelection.range = selection.getRangeAt(0).cloneRange();
        contextMenuSelection.timestamp = Date.now();
        console.log('コンテキストメニュー用選択情報を保存:', contextMenuSelection.text);
    }
};

// ===== ストレージ処理 =====

/**
 * 確実にデータを保存するためのマルチ保存関数
 * localStorage、chrome.storage.local、Service Worker経由の3つの方法でデータを保存する
 * @param {Object} data - 保存するデータ
 * @param {string} key - ストレージキー
 * @returns {Promise<Array<string>>} 各保存方法の結果の配列
 */
const saveHighlightDataReliable = async (data, key) => {
    const saveResults = [];
    
    // 方法1: localStorage（最優先 - コンテキスト無効化の影響を受けない）
    try {
        localStorage.setItem(key, JSON.stringify(data));
        saveResults.push('localStorage: 成功');
        console.log('✅ localStorage保存成功（最優先）');
    } catch (error) {
        saveResults.push(`localStorage: 失敗 - ${error.message}`);
        console.error('❌ localStorage保存失敗:', error);
    }
    
    // 方法2: chrome.storage.local 直接アクセス（コンテキスト確認付き）
    try {
        // 拡張機能のコンテキストが有効かチェック（chrome.storageの存在も確認）
        if (chrome?.runtime?.id && chrome?.storage?.local && checkExtensionContext()) {
            await chrome.storage.local.set({ [key]: data });
            saveResults.push('chrome.storage.local: 成功');
            console.log('✅ chrome.storage.local保存成功');
        } else {
            const reason = !chrome ? 'chromeオブジェクトなし' : 
                          !chrome.runtime ? 'chrome.runtimeなし' :
                          !chrome.runtime.id ? 'chrome.runtime.idなし' :
                          !chrome.storage ? 'chrome.storageなし' :
                          !chrome.storage.local ? 'chrome.storage.localなし' :
                          'checkExtensionContext失敗';
            saveResults.push(`chrome.storage.local: コンテキスト無効 (${reason})`);
            console.log('⚠️ chrome.storage.local: 拡張機能コンテキストが無効です -', reason);
        }
    } catch (error) {
        saveResults.push(`chrome.storage.local: 失敗 - ${error.message}`);
        console.error('❌ chrome.storage.local保存失敗:', error);
        
        // Extension context invalidated の場合は特別な処理
        if (error.message.includes('Extension context invalidated')) {
            console.log('🔄 拡張機能コンテキストが無効化されました。ページリロードを推奨します。');
            
            // ユーザーに通知（1回だけ）
            if (!window.extensionContextInvalidatedNotified) {
                window.extensionContextInvalidatedNotified = true;
                setTimeout(() => {
                    if (confirm('ハイライト拡張機能のコンテキストが無効化されました。\nページをリロードしてハイライト機能を復旧しますか？')) {
                        window.location.reload();
                    }
                }, 1000);
            }
        }
    }
    
    // 方法3: Service Worker経由（最後に試行）
    try {
        const response = await sendMessageSafely({
            action: CONSTANTS.MESSAGE_ACTIONS.SAVE_TO_STORAGE,
            key: key,
            data: data
        }, 1); // リトライ回数を1回に制限
        
        if (response?.success) {
            saveResults.push('Service Worker: 成功');
            console.log('✅ Service Worker保存成功');
        } else {
            saveResults.push('Service Worker: 応答なしまたは失敗');
        }
    } catch (error) {
        saveResults.push(`Service Worker: 例外 - ${error.message}`);
    }
    
    console.log('🔄 保存結果:', saveResults);
    return saveResults;
};

/**
 * ハイライトデータの保存処理
 * @param {Array} highlightData - 保存するハイライトデータ
 * @param {string} currentDomain - 現在のドメイン
 * @returns {Promise<void>}
 */
const saveHighlightData = async (highlightDataParam, currentDomainParam) => {
    try {
        const key = getStorageKey(currentDomainParam);
        
        // キーの有効性をチェック
        if (!key) {
            console.error('ハイライトデータ保存エラー: ストレージキーが無効です', { currentDomain: currentDomainParam });
            return;
        }
        
        const data = {
            domain: currentDomainParam,
            url: window.location.href,
            highlights: highlightDataParam,
            lastUpdated: Date.now()
        };
        
        console.log('📝 ハイライトデータを保存中...', { key, dataLength: highlightDataParam.length });
        
        // 新しい確実な保存方法を使用
        const results = await saveHighlightDataReliable(data, key);
        
        // 成功した保存方法があるかチェック
        const hasSuccess = results.some(result => result.includes('成功'));
        
        if (hasSuccess) {
            console.log('✅ ハイライトデータ保存完了:', results);
        } else {
            console.error('❌ 全ての保存方法が失敗しました:', results);
        }
        
    } catch (error) {
        console.error('ハイライトデータ保存エラー (例外):', {
            error: error.message,
            stack: error.stack,
            currentDomain: currentDomainParam,
            highlightDataLength: highlightDataParam?.length
        });
        
        // 例外時の緊急保存
        try {
            const key = getStorageKey(currentDomainParam);
            const data = {
                domain: currentDomainParam,
                url: window.location.href,
                highlights: highlightDataParam,
                lastUpdated: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(data));
            console.log('🚨 緊急保存: localStorageに保存しました');
        } catch (emergencyError) {
            console.error('🚨 緊急保存も失敗:', emergencyError);
        }
    }
};

// ===== ハイライト管理 =====

/**
 * 選択されたテキストにハイライトを適用する
 * @param {string} color - ハイライトの色（16進数カラーコード）
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
const applyHighlight = (color) => {
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
                addHighlightInfo(parentElement, selectedText, color, highlightSpan.getAttribute(CONSTANTS.DATA_HIGHLIGHT_ID));
            }
            
            // 選択を解除
            window.getSelection().removeAllRanges();
            selectedRange = null;
            selectedText = '';
            
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
        selectedRange = null;
        selectedText = '';
        
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
const removeHighlight = (targetElement) => {
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
const findHighlightElement = (element) => {
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
 * 指定されたテキストでハイライトを適用する
 * @param {string} text - ハイライトを適用するテキスト
 * @param {string} color - ハイライトの色
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
const applyHighlightToText = (text, color) => {
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
};

/**
 * コンテキストメニューからのハイライト処理
 * @param {string} color - ハイライト色
 * @param {string} [selectedTextParam] - 選択されたテキスト（フォールバック用）
 * @returns {boolean} ハイライト適用が成功した場合はtrue
 */
const handleContextMenuHighlight = (color, selectedTextParam = null) => {
    const now = Date.now();
    
    // 保存された選択情報を使用（5秒以内の場合）
    if (contextMenuSelection.range && 
        contextMenuSelection.timestamp && 
        (now - contextMenuSelection.timestamp) < CONSTANTS.TIMEOUTS.CONTEXT_MENU_SELECTION) {
        
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
        
        return success;
    } else {
        // フォールバック: テキスト検索方式
        if (selectedTextParam && selectedTextParam.trim()) {
            return applyHighlightToText(selectedTextParam, color);
        } else {
            console.log('ハイライト適用失敗: 選択情報が見つかりません');
            return false;
        }
    }
};

/**
 * 保存されたハイライト情報を元にページ上のハイライトを復元する
 */
const restoreHighlights = () => {
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
                            
                            // ハイライト要素を作成
                            const highlightSpan = document.createElement('span');
                            highlightSpan.className = CONSTANTS.HIGHLIGHT_CLASS;
                            highlightSpan.style.backgroundColor = highlightInfo.color;
                            highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_COLOR, highlightInfo.color);
                            highlightSpan.setAttribute(CONSTANTS.DATA_HIGHLIGHT_ID, highlightInfo.id);
                            
                            try {
                                range.surroundContents(highlightSpan);
                                console.log('ハイライトを復元しました:', highlightInfo.color, highlightInfo.id);
                            } catch (error) {
                                console.error('ハイライト復元適用エラー:', error);
                            }
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

// ===== イベントリスナー設定 =====

// テキスト選択を監視
document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('keyup', handleTextSelection);

// 右クリック時の処理
document.addEventListener('contextmenu', handleContextMenu);

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

// ===== メッセージハンドラー =====

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === CONSTANTS.MESSAGE_ACTIONS.APPLY_HIGHLIGHT) {
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
                text: selectedText,
                hasSelection: selectedText.length > 0
            });
        }
    } catch (error) {
        console.error('メッセージ処理エラー:', error);
        sendResponse({success: false, error: error.message});
    }
    
    return true; // 非同期レスポンスを示す
});

// ===== 初期化処理 =====

const initialize = async () => {
    console.log('Text Highlighter: コンテンツスクリプト初期化開始');
    
    // 拡張機能のコンテキストをチェック
    if (!checkExtensionContext()) {
        console.log('拡張機能のコンテキストが無効なため、初期化をスキップします');
        return;
    }
    
    // ドメインを設定
    currentDomain = getCurrentDomain();
    console.log('現在のドメイン:', currentDomain);
    
    // ドメインが取得できない場合のエラーハンドリング
    if (!currentDomain) {
        console.error('ドメインの取得に失敗しました:', window.location);
        currentDomain = 'unknown_domain';
    }
    
    // 保存されたハイライトを読み込み
    try {
        const key = getStorageKey(currentDomain);
        console.log('📖 ハイライトデータを読み込み中...', key);
        
        // localStorageから読み込み
        try {
            const localData = localStorage.getItem(key);
            if (localData) {
                const loadedData = JSON.parse(localData);
                highlightData = loadedData.highlights || [];
                console.log('✅ ハイライトデータ読み込み完了:', highlightData.length, '件');
                
                // 保存されたハイライトを復元
                restoreHighlights();
            } else {
                console.log('ℹ️ 保存されたハイライトデータがありません:', key);
                highlightData = [];
            }
        } catch (error) {
            console.error('ハイライトデータ読み込みエラー:', error);
            highlightData = [];
        }
    } catch (error) {
        console.error('ハイライトデータ読み込みエラー (例外):', error);
        highlightData = [];
    }
    
    console.log('Text Highlighter: 初期化完了');
};

// ページ読み込み完了時の処理
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // 既に読み込み済みの場合は即座に初期化
    initialize();
}

// ページ離脱時にデータを保存
window.addEventListener('beforeunload', () => {
    saveHighlightData(highlightData, currentDomain);
});

// デバッグ用テスト関数
window.testStorage = async () => {
    console.log('🚀 === 包括的ストレージテスト開始 ===');
    
    const testKey = 'test_connection_' + Date.now();
    const testData = { test: true, timestamp: Date.now(), version: '2.0' };
    
    // 新しい確実な保存機能をテスト
    console.log('📝 新しい保存機能をテスト中...');
    const saveResults = await saveHighlightDataReliable(testData, testKey);
    
    // 少し待ってから読み込みテスト
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('📖 新しい読み込み機能をテスト中...');
    const localData = localStorage.getItem(testKey);
    const loadResults = localData ? JSON.parse(localData) : null;
    
    if (loadResults) {
        console.log('✅ テストデータ読み込み成功:', loadResults);
    } else {
        console.log('❌ テストデータ読み込み失敗');
    }
    
    // クリーンアップ
    try {
        if (chrome?.storage?.local) {
            await chrome.storage.local.remove([testKey]);
        }
        localStorage.removeItem(testKey);
        console.log('🧹 テストデータをクリーンアップしました');
    } catch (error) {
        console.log('🧹 クリーンアップエラー:', error);
    }
    
    console.log('🎯 === ストレージテスト完了 ===');
    return { saveResults, loadResults };
};
