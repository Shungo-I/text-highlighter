/**
 * Service Worker管理モジュール
 */

// 強化されたService Workerの keep alive機能
let keepAliveInterval;
let isServiceWorkerActive = true;

/**
 * Service Workerの状態を取得する
 * @returns {boolean} Service Workerがアクティブな場合はtrue
 */
export const getServiceWorkerStatus = () => {
    return isServiceWorkerActive;
};

/**
 * Service Workerの keep alive 機能を開始する
 * 定期的にチェックしてService Workerの状態を維持する
 */
export const startKeepAlive = () => {
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

/**
 * keep alive 機能を停止する
 */
export const stopKeepAlive = () => {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('Keep alive機能を停止しました');
    }
};

/**
 * Service Workerの状態を監視し、ライフサイクルイベントに対応する
 */
export const monitorServiceWorkerHealth = () => {
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
