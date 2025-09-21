/**
 * UI制御モジュール
 */

import { CONSTANTS } from '../shared/constants.js';
import {
    addCustomColor,
    getCustomColors,
    removeCustomColor,
    selectColor,
    updateCustomColor
} from './colorManager.js';

// DOM要素
let customColorList;
let addCustomBtn;
let statusMessage;

/**
 * DOM要素を初期化する
 */
export const initializeDOMElements = () => {
    customColorList = document.getElementById('customColorList');
    addCustomBtn = document.getElementById('addCustomBtn');
    statusMessage = document.getElementById('statusMessage');
};

/**
 * ポップアップ内の各要素にイベントリスナーを設定する
 */
export const setupEventListeners = () => {
    // デフォルト色ボタンのイベントリスナー
    const colorButtons = document.querySelectorAll('.color-button[data-color]');
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            const color = button.getAttribute('data-color');
            const colorName = button.textContent;
            selectColor(color, colorName);
            updateSelectedColorButton(color);
        });
    });
    
    // カスタム色追加ボタン
    addCustomBtn.addEventListener('click', () => {
        const customColors = getCustomColors();
        if (customColors.length >= CONSTANTS.LIMITS.MAX_CUSTOM_COLORS) {
            showStatus(`カスタム色は最大${CONSTANTS.LIMITS.MAX_CUSTOM_COLORS}色まで設定できます`, 'error');
            return;
        }
        showCustomColorDialog();
    });
};

/**
 * 選択された色ボタンの表示スタイルを更新する
 * @param {string} selectedColor - 選択された色のカラーコード
 */
export const updateSelectedColorButton = (selectedColor) => {
    // 全ての色ボタンからselectedクラスを削除
    document.querySelectorAll('.color-button').forEach(button => {
        button.classList.remove('selected');
    });
    
    // 選択された色のボタンにselectedクラスを追加
    const selectedButton = document.querySelector(`[data-color="${selectedColor}"]`);
    if (selectedButton) {
        selectedButton.classList.add('selected');
    }
};

/**
 * カスタム色の表示を更新する
 * カスタム色ボタンと削除ボタンを作成し、イベントリスナーを設定する
 */
export const updateCustomColorDisplay = () => {
    const customColors = getCustomColors();
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
                updateSelectedColorButton(colorInfo.color);
            });
            
            // カスタム色削除
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const removedColor = await removeCustomColor(index);
                    updateCustomColorDisplay();
                    if (removedColor) {
                        showStatus(`カスタム色「${removedColor.name}」を削除しました`, 'success');
                    }
                } catch (error) {
                    showStatus('カスタム色の削除に失敗しました', 'error');
                }
            });
            
            colorContainer.appendChild(button);
            colorContainer.appendChild(deleteBtn);
            customColorList.appendChild(colorContainer);
        });
    }
};

/**
 * ステータスメッセージを表示する
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージのタイプ（'success', 'error', など）
 */
export const showStatus = (message, type) => {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = 'block';
    
    // 3秒後に非表示
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, CONSTANTS.TIMEOUTS.STATUS_MESSAGE_DISPLAY);
};

/**
 * カスタム色の追加・編集ダイアログを表示する
 * @param {number|null} [editIndex=null] - 編集する色のインデックス、nullの場合は新規追加
 */
export const showCustomColorDialog = (editIndex = null) => {
    const customColors = getCustomColors();
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
                    <input type="color" id="colorInput" value="${existingColor ? existingColor.color : CONSTANTS.DEFAULT_HIGHLIGHT_COLOR}" 
                           style="width: 100%; height: 40px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #555;">名前</label>
                    <input type="text" id="nameInput" placeholder="色の名前を入力" 
                           value="${existingColor ? existingColor.name : ''}"
                           maxlength="${CONSTANTS.LIMITS.MAX_COLOR_NAME_LENGTH}"
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
    saveBtn.addEventListener('click', async () => {
        const color = colorInput.value;
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('色の名前を入力してください');
            nameInput.focus();
            return;
        }
        
        try {
            if (isEdit) {
                await updateCustomColor(editIndex, color, name);
                showStatus(`カスタム色「${name}」を更新しました`, 'success');
            } else {
                await addCustomColor(color, name);
                showStatus(`カスタム色「${name}」を追加しました`, 'success');
            }
            
            updateCustomColorDisplay();
            closeDialog();
        } catch (error) {
            showStatus(`カスタム色の${isEdit ? '更新' : '追加'}に失敗しました`, 'error');
        }
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
};
