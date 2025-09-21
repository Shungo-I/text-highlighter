/**
 * ストレージ処理ヘルパーモジュール
 */

import { getStorageKey } from '../shared/utils.js';
import { checkExtensionContext, sendMessageSafely } from './extensionContext.js';

/**
 * 確実にデータを保存するためのマルチ保存関数
 * localStorage、chrome.storage.local、Service Worker経由の3つの方法でデータを保存する
 * @param {Object} data - 保存するデータ
 * @param {string} key - ストレージキー
 * @returns {Promise<Array<string>>} 各保存方法の結果の配列
 */
export const saveHighlightDataReliable = async (data, key) => {
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
            action: 'saveToStorage',
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
 * 確実にデータを読み込むためのマルチ読み込み関数
 * localStorage、chrome.storage.local、Service Worker経由の3つの方法でデータを読み込む
 * @param {string} key - ストレージキー
 * @returns {Promise<Object|null>} 読み込まれたデータ、見つからない場合はnull
 */
export const loadHighlightDataReliable = async (key) => {
    let loadedData = null;
    const loadResults = [];
    
    // 方法1: localStorage（最優先 - コンテキスト無効化の影響を受けない）
    try {
        const localData = localStorage.getItem(key);
        if (localData) {
            loadedData = JSON.parse(localData);
            loadResults.push('localStorage: 成功');
            console.log('✅ localStorage読み込み成功（最優先）');
        } else {
            loadResults.push('localStorage: データなし');
        }
    } catch (error) {
        loadResults.push(`localStorage: 失敗 - ${error.message}`);
        console.error('❌ localStorage読み込み失敗:', error);
    }
    
    // 方法2: chrome.storage.local 直接アクセス（コンテキスト確認付き）
    try {
        // 拡張機能のコンテキストが有効かチェック（chrome.storageの存在も確認）
        if (chrome?.runtime?.id && chrome?.storage?.local && checkExtensionContext()) {
            const result = await chrome.storage.local.get([key]);
            if (result[key]) {
                loadedData = result[key];
                loadResults.push('chrome.storage.local: 成功');
                console.log('✅ chrome.storage.local読み込み成功');
            } else {
                loadResults.push('chrome.storage.local: データなし');
            }
        } else {
            const reason = !chrome ? 'chromeオブジェクトなし' : 
                          !chrome.runtime ? 'chrome.runtimeなし' :
                          !chrome.runtime.id ? 'chrome.runtime.idなし' :
                          !chrome.storage ? 'chrome.storageなし' :
                          !chrome.storage.local ? 'chrome.storage.localなし' :
                          'checkExtensionContext失敗';
            loadResults.push(`chrome.storage.local: コンテキスト無効 (${reason})`);
            console.log('⚠️ chrome.storage.local: 拡張機能コンテキストが無効です -', reason);
        }
    } catch (error) {
        loadResults.push(`chrome.storage.local: 失敗 - ${error.message}`);
        console.error('❌ chrome.storage.local読み込み失敗:', error);
        
        // Extension context invalidated の場合は特別な処理
        if (error.message.includes('Extension context invalidated')) {
            console.log('🔄 拡張機能コンテキストが無効化されました。ページリロードを推奨します。');
        }
    }
    
    // 方法3: Service Worker経由（最後に試行）
    if (!loadedData) {
        try {
            const response = await sendMessageSafely({
                action: 'loadFromStorage',
                key: key
            }, 1); // リトライ回数を1回に制限
            
            if (response?.success && response.data) {
                loadedData = response.data;
                loadResults.push('Service Worker: 成功');
                console.log('✅ Service Worker読み込み成功');
            } else {
                loadResults.push('Service Worker: データなしまたは失敗');
            }
        } catch (error) {
            loadResults.push(`Service Worker: 例外 - ${error.message}`);
        }
    }
    
    console.log('🔄 読み込み結果:', loadResults);
    return loadedData;
};

/**
 * ハイライトデータの保存処理
 * @param {Array} highlightData - 保存するハイライトデータ
 * @param {string} currentDomain - 現在のドメイン
 * @returns {Promise<void>}
 */
export const saveHighlightData = async (highlightData, currentDomain) => {
    try {
        const key = getStorageKey(currentDomain);
        
        // キーの有効性をチェック
        if (!key) {
            console.error('ハイライトデータ保存エラー: ストレージキーが無効です', { currentDomain });
            return;
        }
        
        const data = {
            domain: currentDomain,
            url: window.location.href,
            highlights: highlightData,
            lastUpdated: Date.now()
        };
        
        console.log('📝 ハイライトデータを保存中...', { key, dataLength: highlightData.length });
        
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
            currentDomain: currentDomain,
            highlightDataLength: highlightData?.length
        });
        
        // 例外時の緊急保存
        try {
            const key = getStorageKey(currentDomain);
            const data = {
                domain: currentDomain,
                url: window.location.href,
                highlights: highlightData,
                lastUpdated: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(data));
            console.log('🚨 緊急保存: localStorageに保存しました');
        } catch (emergencyError) {
            console.error('🚨 緊急保存も失敗:', emergencyError);
        }
    }
};

/**
 * ハイライトデータの読み込み処理
 * @param {string} currentDomain - 現在のドメイン
 * @returns {Promise<Array>} 読み込まれたハイライトデータ
 */
export const loadHighlightData = async (currentDomain) => {
    try {
        const key = getStorageKey(currentDomain);
        console.log('📖 ハイライトデータを読み込み中...', key);
        
        // 新しい確実な読み込み方法を使用
        const loadedData = await loadHighlightDataReliable(key);
        
        if (loadedData) {
            const highlightData = loadedData.highlights || [];
            console.log('✅ ハイライトデータ読み込み完了:', highlightData.length, '件');
            return highlightData;
        } else {
            console.log('ℹ️ 保存されたハイライトデータがありません:', key);
            return [];
        }
        
    } catch (error) {
        console.error('ハイライトデータ読み込みエラー (例外):', {
            error: error.message,
            stack: error.stack
        });
        
        // 例外時の緊急読み込み
        try {
            const key = getStorageKey(currentDomain);
            const localData = localStorage.getItem(key);
            if (localData) {
                const parsedData = JSON.parse(localData);
                const highlightData = parsedData.highlights || [];
                console.log('🚨 緊急読み込み: localStorageから', highlightData.length, '件');
                return highlightData;
            } else {
                return [];
            }
        } catch (emergencyError) {
            console.error('🚨 緊急読み込みも失敗:', emergencyError);
            return [];
        }
    }
};

/**
 * デバッグ用の包括的ストレージテスト関数
 * 新しい保存・読み込み機能をテストし、結果をコンソールに出力する
 * @returns {Promise<{saveResults: Array<string>, loadResults: any}>} テスト結果
 */
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
    const loadResults = await loadHighlightDataReliable(testKey);
    
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
