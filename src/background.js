// Text Highlighter Background Script
console.log('Text Highlighter バックグラウンドスクリプトが読み込まれました');

// 強化されたService Workerの keep alive機能
let keepAliveInterval;
let isServiceWorkerActive = true;

const startKeepAlive = () => {
    console.log('Keep alive機能を開始します');
    
    // より頻繁に(10秒ごと)チェックして、接続を維持
    keepAliveInterval = setInterval(async () => {
        try {
            // Service Workerを維持するための軽い処理
            await chrome.runtime.getPlatformInfo();
            
            if (!isServiceWorkerActive) {
                console.log('Service Worker復旧を検出');
                isServiceWorkerActive = true;
            }
        } catch (error) {
            if (isServiceWorkerActive) {
                console.log('Service Worker keep alive 失敗:', error.message);
                isServiceWorkerActive = false;
            }
            
            // Service Workerの再起動を試みる
            try {
                await chrome.storage.local.get(['_keepalive']);
            } catch (retryError) {
                console.log('Service Worker再起動試行失敗:', retryError.message);
            }
        }
    }, 10000); // 10秒ごと
};

const stopKeepAlive = () => {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('Keep alive機能を停止しました');
    }
};

// Service Worker状態監視
const monitorServiceWorkerHealth = () => {
    // アイドル状態の検出と対応
    if (chrome.idle && chrome.idle.onStateChanged) {
        chrome.idle.onStateChanged.addListener((newState) => {
            console.log('アイドル状態変更:', newState);
            if (newState === 'active') {
                // アクティブになった時にkeep aliveを再開
                if (!keepAliveInterval) {
                    startKeepAlive();
                }
            }
        });
    }
    
    // Service Workerのライフサイクル監視
    if (chrome.runtime.onSuspend) {
        chrome.runtime.onSuspend.addListener(() => {
            console.log('Service Worker suspend検出');
            stopKeepAlive();
        });
    }
    
    if (chrome.runtime.onSuspendCanceled) {
        chrome.runtime.onSuspendCanceled.addListener(() => {
            console.log('Service Worker suspend キャンセル検出');
            startKeepAlive();
        });
    }
};

// Service Worker起動時に keep alive を開始
startKeepAlive();
monitorServiceWorkerHealth();

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Text Highlighter がインストールされました');
    
    // 右クリックメニューを作成
    createContextMenus();
});

// 右クリックメニューの作成
const createContextMenus = () => {
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

// 右クリックメニューのクリック処理
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('右クリックメニューがクリックされました:', info.menuItemId);
    
    if (info.menuItemId === "addHighlight") {
        // 現在選択中の色を取得してコンテンツスクリプトにハイライト追加を指示
        getCurrentHighlightColorFromStorage().then(color => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'addHighlightFromContext',
                selectedText: info.selectionText,
                color: color
            });
        });
    }
});

// 強化されたメッセージハンドラー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background: メッセージを受信しました:', {
        action: request.action,
        sender: sender.tab?.url || 'popup',
        timestamp: new Date().toISOString()
    });
    
    // 非同期処理のためのフラグ
    let isAsync = false;
    
    try {
        // Service Worker状態確認のためのpingメッセージ
        if (request.action === 'ping') {
            console.log('Background: Pingメッセージを受信しました');
            sendResponse({ 
                success: true, 
                message: 'Service Worker is active',
                timestamp: Date.now(),
                workerStatus: isServiceWorkerActive
            });
            return false; // 同期レスポンス
        }
        
        // ポップアップとコンテンツスクリプト間の通信を中継
        else if (request.action === 'textSelected' || request.action === 'textDeselected') {
            console.log('Background: テキスト選択状態の変更を受信しました');
            sendResponse({ success: true, message: 'Selection state received' });
            return false; // 同期レスポンス
        }
        
        // ストレージアクセス関連のメッセージ処理
        else if (request.action === 'saveToStorage') {
            isAsync = true;
            handleSaveToStorage(request, sendResponse);
            return true; // 非同期レスポンスを示す
        }
        else if (request.action === 'loadFromStorage') {
            isAsync = true;
            handleLoadFromStorage(request, sendResponse);
            return true; // 非同期レスポンスを示す
        }
        
        // その他のメッセージについても応答を返す
        else {
            console.log('Background: 不明なアクション:', request.action);
            sendResponse({ 
                success: true, 
                message: 'Unknown action received',
                action: request.action
            });
            return false; // 同期レスポンス
        }
    } catch (error) {
        console.error('Background: メッセージ処理エラー:', error);
        
        // エラーが発生した場合でも応答を返す
        if (!isAsync) {
            sendResponse({ 
                success: false, 
                error: error.message,
                action: request.action
            });
        }
        return false;
    }
});

// 強化されたストレージ保存処理
const handleSaveToStorage = async (request, sendResponse) => {
    const startTime = Date.now();
    
    try {
        // リクエストの妥当性チェック
        if (!request.key || !request.data) {
            throw new Error('Invalid request: key or data is missing');
        }
        
        console.log('ストレージ保存開始:', {
            key: request.key,
            dataSize: JSON.stringify(request.data).length,
            timestamp: new Date().toISOString()
        });
        
        await chrome.storage.local.set({ [request.key]: request.data });
        
        const duration = Date.now() - startTime;
        console.log('ストレージ保存完了:', {
            key: request.key,
            duration: duration + 'ms',
            success: true
        });
        
        sendResponse({ 
            success: true,
            timestamp: Date.now(),
            duration: duration
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('ストレージ保存エラー:', {
            key: request.key,
            error: error.message,
            duration: duration + 'ms'
        });
        
        sendResponse({ 
            success: false, 
            error: error.message,
            timestamp: Date.now(),
            duration: duration
        });
    }
};

// 強化されたストレージ読み込み処理
const handleLoadFromStorage = async (request, sendResponse) => {
    const startTime = Date.now();
    
    try {
        // リクエストの妥当性チェック
        if (!request.key) {
            throw new Error('Invalid request: key is missing');
        }
        
        console.log('ストレージ読み込み開始:', {
            key: request.key,
            timestamp: new Date().toISOString()
        });
        
        const result = await chrome.storage.local.get([request.key]);
        
        const duration = Date.now() - startTime;
        console.log('ストレージ読み込み完了:', {
            key: request.key,
            hasData: !!result[request.key],
            duration: duration + 'ms'
        });
        
        sendResponse({ 
            success: true, 
            data: result[request.key],
            timestamp: Date.now(),
            duration: duration
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('ストレージ読み込みエラー:', {
            key: request.key,
            error: error.message,
            duration: duration + 'ms'
        });
        
        sendResponse({ 
            success: false, 
            error: error.message,
            timestamp: Date.now(),
            duration: duration
        });
    }
};

// 現在のハイライト色をストレージから取得
const getCurrentHighlightColorFromStorage = async () => {
    try {
        const result = await chrome.storage.sync.get(['current_highlight_color']);
        const color = result.current_highlight_color || '#ffff00'; // デフォルトは黄色
        return color;
    } catch (error) {
        console.error('現在のハイライト色取得エラー:', error);
        return '#ffff00'; // デフォルトは黄色
    }
};
