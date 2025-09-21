/**
 * メッセージ処理モジュール
 */

import { CONSTANTS } from '../shared/constants.js';
import { getServiceWorkerStatus } from './serviceWorkerManager.js';

/**
 * ストレージへのデータ保存を処理する
 * @param {Object} request - リクエストオブジェクト（keyとdataを含む）
 * @param {Function} sendResponse - レスポンスを送信する関数
 * @returns {Promise<void>}
 */
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

/**
 * ストレージからのデータ読み込みを処理する
 * @param {Object} request - リクエストオブジェクト（keyを含む）
 * @param {Function} sendResponse - レスポンスを送信する関数
 * @returns {Promise<void>}
 */
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

/**
 * メッセージハンドラーを設定する
 */
export const setupMessageHandler = () => {
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
            if (request.action === CONSTANTS.MESSAGE_ACTIONS.PING) {
                console.log('Background: Pingメッセージを受信しました');
                sendResponse({ 
                    success: true, 
                    message: 'Service Worker is active',
                    timestamp: Date.now(),
                    workerStatus: getServiceWorkerStatus()
                });
                return false; // 同期レスポンス
            }
            
            // ポップアップとコンテンツスクリプト間の通信を中継
            else if (request.action === CONSTANTS.MESSAGE_ACTIONS.TEXT_SELECTED || 
                     request.action === CONSTANTS.MESSAGE_ACTIONS.TEXT_DESELECTED) {
                console.log('Background: テキスト選択状態の変更を受信しました');
                sendResponse({ success: true, message: 'Selection state received' });
                return false; // 同期レスポンス
            }
            
            // ストレージアクセス関連のメッセージ処理
            else if (request.action === CONSTANTS.MESSAGE_ACTIONS.SAVE_TO_STORAGE) {
                isAsync = true;
                handleSaveToStorage(request, sendResponse);
                return true; // 非同期レスポンスを示す
            }
            else if (request.action === CONSTANTS.MESSAGE_ACTIONS.LOAD_FROM_STORAGE) {
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
};
