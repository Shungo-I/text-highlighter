/**
 * 色管理モジュール
 */

import { CONSTANTS } from '../shared/constants.js';

// カスタム色データ
let customColors = [];
let currentHighlightColor = CONSTANTS.DEFAULT_HIGHLIGHT_COLOR;
let currentColorName = '黄色';

/**
 * 現在の色を取得する
 * @returns {Object} 現在の色情報
 */
export const getCurrentColor = () => {
    return {
        color: currentHighlightColor,
        name: currentColorName
    };
};

/**
 * カスタム色を取得する
 * @returns {Array} カスタム色配列
 */
export const getCustomColors = () => {
    return customColors;
};

/**
 * ハイライト色を選択し、現在の色として設定する
 * @param {string} color - 選択する色（16進数カラーコード）
 * @param {string} colorName - 色の名前
 */
export const selectColor = (color, colorName) => {
    currentHighlightColor = color;
    currentColorName = colorName;
    saveCurrentColor();
};

/**
 * 現在選択されているハイライト色をストレージに保存する
 * @returns {Promise<void>}
 */
const saveCurrentColor = async () => {
    try {
        await chrome.storage.sync.set({ 
            [CONSTANTS.STORAGE_KEYS.CURRENT_HIGHLIGHT_COLOR]: currentHighlightColor,
            [CONSTANTS.STORAGE_KEYS.CURRENT_COLOR_NAME]: currentColorName
        });
    } catch (error) {
        console.error('現在の色保存エラー:', error);
    }
};

/**
 * ストレージから現在のハイライト色を読み込む
 * @returns {Promise<void>}
 */
export const loadCurrentColor = async () => {
    try {
        const result = await chrome.storage.sync.get([
            CONSTANTS.STORAGE_KEYS.CURRENT_HIGHLIGHT_COLOR, 
            CONSTANTS.STORAGE_KEYS.CURRENT_COLOR_NAME
        ]);
        if (result[CONSTANTS.STORAGE_KEYS.CURRENT_HIGHLIGHT_COLOR]) {
            currentHighlightColor = result[CONSTANTS.STORAGE_KEYS.CURRENT_HIGHLIGHT_COLOR];
            currentColorName = result[CONSTANTS.STORAGE_KEYS.CURRENT_COLOR_NAME] || '選択された色';
        }
    } catch (error) {
        console.error('現在の色読み込みエラー:', error);
    }
};

/**
 * ストレージからカスタム色の一覧を読み込む
 * @returns {Promise<void>}
 */
export const loadCustomColors = async () => {
    try {
        const result = await chrome.storage.sync.get([CONSTANTS.STORAGE_KEYS.CUSTOM_COLORS]);
        customColors = result[CONSTANTS.STORAGE_KEYS.CUSTOM_COLORS] || [];
        console.log('カスタム色を読み込みました:', customColors);
    } catch (error) {
        console.error('カスタム色読み込みエラー:', error);
        customColors = [];
    }
};

/**
 * 新しいカスタム色を追加する
 * @param {string} color - 追加する色（16進数カラーコード）
 * @param {string} name - 色の名前
 * @returns {Promise<void>}
 */
export const addCustomColor = async (color, name) => {
    try {
        const newColor = {
            color: color,
            name: name,
            id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
        };
        
        customColors.push(newColor);
        await saveCustomColors();
        console.log(`カスタム色「${name}」を追加しました`);
    } catch (error) {
        console.error('カスタム色追加エラー:', error);
        throw error;
    }
};

/**
 * 既存のカスタム色を更新する
 * @param {number} index - 更新する色のインデックス
 * @param {string} color - 新しい色（16進数カラーコード）
 * @param {string} name - 新しい色の名前
 * @returns {Promise<void>}
 */
export const updateCustomColor = async (index, color, name) => {
    try {
        if (index >= 0 && index < customColors.length) {
            customColors[index].color = color;
            customColors[index].name = name;
            await saveCustomColors();
            console.log(`カスタム色「${name}」を更新しました`);
        }
    } catch (error) {
        console.error('カスタム色更新エラー:', error);
        throw error;
    }
};

/**
 * 指定されたインデックスのカスタム色を削除する
 * @param {number} index - 削除する色のインデックス
 * @returns {Promise<void>}
 */
export const removeCustomColor = async (index) => {
    try {
        if (index >= 0 && index < customColors.length) {
            const removedColor = customColors[index];
            customColors.splice(index, 1);
            await saveCustomColors();
            console.log(`カスタム色「${removedColor.name}」を削除しました`);
            return removedColor;
        }
    } catch (error) {
        console.error('カスタム色削除エラー:', error);
        throw error;
    }
};

/**
 * カスタム色の配列をストレージに保存する
 * @returns {Promise<void>}
 * @throws {Error} 保存に失敗した場合
 */
const saveCustomColors = async () => {
    try {
        await chrome.storage.sync.set({ [CONSTANTS.STORAGE_KEYS.CUSTOM_COLORS]: customColors });
        console.log('カスタム色を保存しました:', customColors);
    } catch (error) {
        console.error('カスタム色保存エラー:', error);
        throw error;
    }
};
