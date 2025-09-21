/**
 * 拡張機能コンテキスト管理モジュール
 */

// 拡張機能の状態チェック
let extensionValid = true;

/**
 * 拡張機能のコンテキストが有効かどうかをチェックする
 * @returns {boolean} 拡張機能のコンテキストが有効な場合はtrue、無効な場合はfalse
 */
export const checkExtensionContext = () => {
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
export const isExtensionValid = () => {
    return extensionValid;
};

/**
 * Service Workerの状態を確認する
 * @returns {Promise<boolean>} Service Workerがアクティブな場合はtrue
 */
export const checkServiceWorkerStatus = async () => {
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
export const sendMessageSafely = async (message, maxRetries = 3) => {
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
