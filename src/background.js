// Text Highlighter Background Script
console.log('Text Highlighter バックグラウンドスクリプトが読み込まれました');

// Service Workerの keep alive機能
let keepAliveInterval;

function startKeepAlive() {
    // より頻繁に(15秒ごと)チェックして、接続を維持
    keepAliveInterval = setInterval(() => {
        try {
            // Service Workerを維持するための軽い処理
            chrome.runtime.getPlatformInfo().catch((error) => {
                console.log('Keep alive ping failed:', error.message);
            });
        } catch (error) {
            console.log('Keep alive error:', error.message);
        }
    }, 15000); // 15秒ごと
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// Service Worker起動時に keep alive を開始
startKeepAlive();

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('Text Highlighter がインストールされました');
    
    // 右クリックメニューを作成
    createContextMenus();
});

// 右クリックメニューの作成
function createContextMenus() {
    // 既存のメニューをクリア
    chrome.contextMenus.removeAll(function() {
        // ハイライト追加メニューを作成
        chrome.contextMenus.create({
            id: "addHighlight",
            title: "ハイライトを追加",
            contexts: ["selection"],
            documentUrlPatterns: ["<all_urls>"]
        });
        
        // ハイライト削除メニューを作成
        chrome.contextMenus.create({
            id: "removeHighlight",
            title: "ハイライトを削除",
            contexts: ["selection"],
            documentUrlPatterns: ["<all_urls>"]
        });
        
        console.log('右クリックメニューを作成しました');
    });
}

// 右クリックメニューのクリック処理
chrome.contextMenus.onClicked.addListener(function(info, tab) {
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
    } else if (info.menuItemId === "removeHighlight") {
        // コンテンツスクリプトにハイライト削除を指示
        chrome.tabs.sendMessage(tab.id, {
            action: 'removeHighlight',
            selectedText: info.selectionText
        });
    }
});

// コンテンツスクリプトからのメッセージを中継
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Background: メッセージを受信しました:', request.action);
    
    // ポップアップとコンテンツスクリプト間の通信を中継
    if (request.action === 'textSelected' || request.action === 'textDeselected') {
        // ポップアップが開いている場合のみ通知
        // Service Worker内でのメッセージ送信は不要（ポップアップから直接コンテンツスクリプトにアクセス）
        console.log('Background: テキスト選択状態の変更を受信しました');
    }
    // ストレージアクセス関連のメッセージ処理
    else if (request.action === 'saveToStorage') {
        handleSaveToStorage(request, sendResponse);
        return true; // 非同期レスポンスを示す
    }
    else if (request.action === 'loadFromStorage') {
        handleLoadFromStorage(request, sendResponse);
        return true; // 非同期レスポンスを示す
    }
    
    // その他のメッセージについても応答を返す
    if (sendResponse) {
        sendResponse({ success: true, message: 'Message received' });
    }
    
    return true;
});

// ストレージ保存処理
async function handleSaveToStorage(request, sendResponse) {
    try {
        await chrome.storage.local.set({ [request.key]: request.data });
        console.log('ストレージに保存しました:', request.key);
        sendResponse({ success: true });
    } catch (error) {
        console.error('ストレージ保存エラー:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// ストレージ読み込み処理
async function handleLoadFromStorage(request, sendResponse) {
    try {
        const result = await chrome.storage.local.get([request.key]);
        console.log('ストレージから読み込みました:', request.key);
        sendResponse({ success: true, data: result[request.key] });
    } catch (error) {
        console.error('ストレージ読み込みエラー:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 現在のハイライト色をストレージから取得
async function getCurrentHighlightColorFromStorage() {
    try {
        const result = await chrome.storage.sync.get(['current_highlight_color']);
        const color = result.current_highlight_color || '#ffff00'; // デフォルトは黄色
        return color;
    } catch (error) {
        console.error('現在のハイライト色取得エラー:', error);
        return '#ffff00'; // デフォルトは黄色
    }
}
