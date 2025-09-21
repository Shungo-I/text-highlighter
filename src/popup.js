// Text Highlighter Popup Script
console.log('ポップアップスクリプトが読み込まれました');

// グローバル変数
let currentTab = null;
let selectedText = '';
let customColors = [];
let currentHighlightColor = '#ffff00'; // デフォルト色（黄色）
let currentColorName = '黄色';

// DOM要素
const customColorList = document.getElementById('customColorList');
const addCustomBtn = document.getElementById('addCustomBtn');
const statusMessage = document.getElementById('statusMessage');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('ポップアップDOM読み込み完了');
    initializePopup();
});

/**
 * ポップアップの初期化を行う
 * 現在のタブの取得、カスタム色の読み込み、イベントリスナーの設定などを行う
 * @returns {Promise<void>}
 */
const initializePopup = async () => {
    try {
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
        
        // 選択された色ボタンの表示を更新
        updateSelectedColorButton(currentHighlightColor);
        
        console.log('ポップアップ初期化完了');
    } catch (error) {
        console.error('ポップアップ初期化エラー:', error);
        showStatus('初期化に失敗しました', 'error');
    }
}

/**
 * 現在選択されているテキストの情報をコンテンツスクリプトから取得して更新する
 * @returns {Promise<void>}
 */
const updateSelectionInfo = async () => {
    try {
        // コンテンツスクリプトから選択情報を取得
        const response = await chrome.tabs.sendMessage(currentTab.id, {
            action: 'getSelectedText'
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
}

// 削除：選択情報表示関数は不要

/**
 * ポップアップ内の各要素にイベントリスナーを設定する
 */
const setupEventListeners = () => {
    // デフォルト色ボタンのイベントリスナー
    const colorButtons = document.querySelectorAll('.color-button[data-color]');
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            const color = button.getAttribute('data-color');
            const colorName = button.textContent;
            selectColor(color, colorName);
        });
    });
    
    
    // カスタム色追加ボタン
    addCustomBtn.addEventListener('click', () => {
        if (customColors.length >= 8) {
            showStatus('カスタム色は最大8色まで設定できます', 'error');
            return;
        }
        showCustomColorDialog();
    });
    
}

/**
 * ハイライト色を選択し、現在の色として設定する
 * @param {string} color - 選択する色（16進数カラーコード）
 * @param {string} colorName - 色の名前
 */
const selectColor = (color, colorName) => {
    currentHighlightColor = color;
    currentColorName = colorName;
    updateSelectedColorButton(color);
    saveCurrentColor();
}


/**
 * 選択された色ボタンの表示スタイルを更新する
 * @param {string} selectedColor - 選択された色のカラーコード
 */
const updateSelectedColorButton = (selectedColor) => {
    // 全ての色ボタンからselectedクラスを削除
    document.querySelectorAll('.color-button').forEach(button => {
        button.classList.remove('selected');
    });
    
    // 選択された色のボタンにselectedクラスを追加
    const selectedButton = document.querySelector(`[data-color="${selectedColor}"]`);
    if (selectedButton) {
        selectedButton.classList.add('selected');
    }
}

/**
 * 現在選択されているハイライト色をストレージに保存する
 * @returns {Promise<void>}
 */
const saveCurrentColor = async () => {
    try {
        await chrome.storage.sync.set({ 
            current_highlight_color: currentHighlightColor,
            current_color_name: currentColorName
        });
    } catch (error) {
        console.error('現在の色保存エラー:', error);
    }
}

/**
 * ストレージから現在のハイライト色を読み込む
 * @returns {Promise<void>}
 */
const loadCurrentColor = async () => {
    try {
        const result = await chrome.storage.sync.get(['current_highlight_color', 'current_color_name']);
        if (result.current_highlight_color) {
            currentHighlightColor = result.current_highlight_color;
            currentColorName = result.current_color_name || '選択された色';
        }
    } catch (error) {
        console.error('現在の色読み込みエラー:', error);
    }
}


/**
 * ストレージからカスタム色の一覧を読み込む
 * @returns {Promise<void>}
 */
const loadCustomColors = async () => {
    try {
        const result = await chrome.storage.sync.get(['custom_colors']);
        customColors = result.custom_colors || [];
        console.log('カスタム色を読み込みました:', customColors);
        updateCustomColorDisplay();
    } catch (error) {
        console.error('カスタム色読み込みエラー:', error);
        customColors = [];
        updateCustomColorDisplay();
    }
}

/**
 * カスタム色の表示を更新する
 * カスタム色ボタンと削除ボタンを作成し、イベントリスナーを設定する
 */
const updateCustomColorDisplay = () => {
    customColorList.innerHTML = '';
    
    if (customColors.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-custom';
        emptyDiv.textContent = 'カスタム色はまだ設定されていません';
        customColorList.appendChild(emptyDiv);
    } else {
        customColors.forEach((colorInfo, index) => {
            const colorContainer = document.createElement('div');
            colorContainer.style.position = 'relative';
            
            const button = document.createElement('button');
            button.className = 'color-button';
            button.style.backgroundColor = colorInfo.color;
            button.textContent = colorInfo.name;
            button.title = colorInfo.name;
            button.setAttribute('data-color', colorInfo.color);
            
            // 削除ボタンを追加
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '×';
            deleteBtn.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                width: 16px;
                height: 16px;
                background: #ff4444;
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 10px;
                cursor: pointer;
                display: none;
            `;
            deleteBtn.title = 'この色を削除';
            
            // ホバー時に削除ボタンを表示
            colorContainer.addEventListener('mouseenter', () => {
                deleteBtn.style.display = 'block';
            });
            colorContainer.addEventListener('mouseleave', () => {
                deleteBtn.style.display = 'none';
            });
            
            // 色選択
            button.addEventListener('click', () => {
                selectColor(colorInfo.color, colorInfo.name);
            });
            
            // カスタム色削除
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeCustomColor(index);
            });
            
            colorContainer.appendChild(button);
            colorContainer.appendChild(deleteBtn);
            customColorList.appendChild(colorContainer);
        });
    }
}

/**
 * ステータスメッセージを表示する
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージのタイプ（'success', 'error', など）
 */
const showStatus = (message, type) => {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = 'block';
    
    // 3秒後に非表示
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

// タブの更新を監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === currentTab?.id && changeInfo.status === 'complete') {
        updateSelectionInfo();
    }
});

/**
 * カスタム色の追加・編集ダイアログを表示する
 * @param {number|null} [editIndex=null] - 編集する色のインデックス、nullの場合は新規追加
 */
const showCustomColorDialog = (editIndex = null) => {
    const isEdit = editIndex !== null;
    const existingColor = isEdit ? customColors[editIndex] : null;
    
    // ダイアログHTML
    const dialogHtml = `
        <div id="customColorDialog" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                width: 280px;
            ">
                <h3 style="margin: 0 0 16px 0; color: #2c3e50;">
                    ${isEdit ? 'カスタム色を編集' : 'カスタム色を追加'}
                </h3>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #555;">色</label>
                    <input type="color" id="colorInput" value="${existingColor ? existingColor.color : '#ffff00'}" 
                           style="width: 100%; height: 40px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #555;">名前</label>
                    <input type="text" id="nameInput" placeholder="色の名前を入力" 
                           value="${existingColor ? existingColor.name : ''}"
                           maxlength="10"
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="saveCustomColor" style="
                        flex: 1;
                        padding: 8px;
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">${isEdit ? '更新' : '保存'}</button>
                    <button id="cancelCustomColor" style="
                        flex: 1;
                        padding: 8px;
                        background: #95a5a6;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">キャンセル</button>
                </div>
            </div>
        </div>
    `;
    
    // ダイアログを挿入
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
    
    const dialog = document.getElementById('customColorDialog');
    const colorInput = document.getElementById('colorInput');
    const nameInput = document.getElementById('nameInput');
    const saveBtn = document.getElementById('saveCustomColor');
    const cancelBtn = document.getElementById('cancelCustomColor');
    
    // フォーカスを名前入力欄に設定
    nameInput.focus();
    
    // 保存ボタン
    saveBtn.addEventListener('click', () => {
        const color = colorInput.value;
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('色の名前を入力してください');
            nameInput.focus();
            return;
        }
        
        if (isEdit) {
            updateCustomColor(editIndex, color, name);
        } else {
            addCustomColor(color, name);
        }
        
        closeDialog();
    });
    
    // キャンセルボタン
    cancelBtn.addEventListener('click', closeDialog);
    
    // ESCキーでダイアログを閉じる
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Enterキーで保存
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });
    
    const closeDialog = () => {
        dialog.remove();
    };
}

/**
 * 新しいカスタム色を追加する
 * @param {string} color - 追加する色（16進数カラーコード）
 * @param {string} name - 色の名前
 * @returns {Promise<void>}
 */
const addCustomColor = async (color, name) => {
    try {
        const newColor = {
            color: color,
            name: name,
            id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
        };
        
        customColors.push(newColor);
        await saveCustomColors();
        updateCustomColorDisplay();
        showStatus(`カスタム色「${name}」を追加しました`, 'success');
    } catch (error) {
        console.error('カスタム色追加エラー:', error);
        showStatus('カスタム色の追加に失敗しました', 'error');
    }
}

/**
 * 既存のカスタム色を更新する
 * @param {number} index - 更新する色のインデックス
 * @param {string} color - 新しい色（16進数カラーコード）
 * @param {string} name - 新しい色の名前
 * @returns {Promise<void>}
 */
const updateCustomColor = async (index, color, name) => {
    try {
        if (index >= 0 && index < customColors.length) {
            customColors[index].color = color;
            customColors[index].name = name;
            await saveCustomColors();
            updateCustomColorDisplay();
            showStatus(`カスタム色「${name}」を更新しました`, 'success');
        }
    } catch (error) {
        console.error('カスタム色更新エラー:', error);
        showStatus('カスタム色の更新に失敗しました', 'error');
    }
}

/**
 * 指定されたインデックスのカスタム色を削除する
 * @param {number} index - 削除する色のインデックス
 * @returns {Promise<void>}
 */
const removeCustomColor = async (index) => {
    try {
        if (index >= 0 && index < customColors.length) {
            const removedColor = customColors[index];
            customColors.splice(index, 1);
            await saveCustomColors();
            updateCustomColorDisplay();
            showStatus(`カスタム色「${removedColor.name}」を削除しました`, 'success');
        }
    } catch (error) {
        console.error('カスタム色削除エラー:', error);
        showStatus('カスタム色の削除に失敗しました', 'error');
    }
}


/**
 * カスタム色の配列をストレージに保存する
 * @returns {Promise<void>}
 * @throws {Error} 保存に失敗した場合
 */
const saveCustomColors = async () => {
    try {
        await chrome.storage.sync.set({ custom_colors: customColors });
        console.log('カスタム色を保存しました:', customColors);
    } catch (error) {
        console.error('カスタム色保存エラー:', error);
        throw error;
    }
}

// ページのメッセージを監視
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'textSelected') {
        selectedText = request.text;
    } else if (request.action === 'textDeselected') {
        selectedText = '';
    }
});
