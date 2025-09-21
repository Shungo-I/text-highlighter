/**
 * ポップアップスクリプトのメインエントリーポイント
 */

import { CONSTANTS } from '../shared/constants.js';
import { getCurrentColor, loadCurrentColor, loadCustomColors } from './colorManager.js';
import {
    initializeDOMElements,
    setupEventListeners,
    showStatus,
    updateCustomColorDisplay,
    updateSelectedColorButton
} from './uiController.js';

// Text Highlighter Popup Script
console.log('ポップアップスクリプトが読み込まれました');

// グローバル変数
let currentTab = null;
let selectedText = '';

/**
 * 現在選択されているテキストの情報をコンテンツスクリプトから取得して更新する
 * @returns {Promise<void>}
 */
const updateSelectionInfo = async () => {
    try {
        // コンテンツスクリプトから選択情報を取得
        const response = await chrome.tabs.sendMessage(currentTab.id, {
            action: CONSTANTS.MESSAGE_ACTIONS.GET_SELECTED_TEXT
        });
        
        if (response && response.hasSelection) {
            selectedText = response.text;
        } else {
            selectedText = '';
        }
    } catch (error) {
        console.error('選択情報取得エラー:', error);
        selectedText = '';
    }
};

/**
 * ポップアップの初期化を行う
 * 現在のタブの取得、カスタム色の読み込み、イベントリスナーの設定などを行う
 * @returns {Promise<void>}
 */
const initializePopup = async () => {
    try {
        // DOM要素を初期化
        initializeDOMElements();
        
        // 現在のタブを取得
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];
        
        // 選択状態を確認（表示はしないが、selectedTextを更新するため）
        await updateSelectionInfo();
        
        // カスタム色を読み込み
        await loadCustomColors();
        
        // 現在の色を読み込み
        await loadCurrentColor();
        
        // イベントリスナーを設定
        setupEventListeners();
        
        // カスタム色の表示を更新
        updateCustomColorDisplay();
        
        // 選択された色ボタンの表示を更新
        const currentColor = getCurrentColor();
        updateSelectedColorButton(currentColor.color);
        
        console.log('ポップアップ初期化完了');
    } catch (error) {
        console.error('ポップアップ初期化エラー:', error);
        showStatus('初期化に失敗しました', 'error');
    }
};

// タブの更新を監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === currentTab?.id && changeInfo.status === 'complete') {
        updateSelectionInfo();
    }
});

// ページのメッセージを監視
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === CONSTANTS.MESSAGE_ACTIONS.TEXT_SELECTED) {
        selectedText = request.text;
    } else if (request.action === CONSTANTS.MESSAGE_ACTIONS.TEXT_DESELECTED) {
        selectedText = '';
    }
});

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('ポップアップDOM読み込み完了');
    initializePopup();
});
