// 共通定数定義
export const CONSTANTS = {
    // デフォルトハイライト色
    DEFAULT_HIGHLIGHT_COLOR: '#ffff00',
    
    // ハイライト要素のクラス名
    HIGHLIGHT_CLASS: 'text-highlighter-highlight',
    
    // データ属性名
    DATA_HIGHLIGHT_COLOR: 'data-highlight-color',
    DATA_HIGHLIGHT_ID: 'data-highlight-id',
    
    // ストレージキー
    STORAGE_KEYS: {
        CURRENT_HIGHLIGHT_COLOR: 'current_highlight_color',
        CURRENT_COLOR_NAME: 'current_color_name',
        CUSTOM_COLORS: 'custom_colors'
    },
    
    // メッセージアクション
    MESSAGE_ACTIONS: {
        PING: 'ping',
        TEXT_SELECTED: 'textSelected',
        TEXT_DESELECTED: 'textDeselected',
        APPLY_HIGHLIGHT: 'applyHighlight',
        ADD_HIGHLIGHT_FROM_CONTEXT: 'addHighlightFromContext',
        GET_SELECTED_TEXT: 'getSelectedText',
        SAVE_TO_STORAGE: 'saveToStorage',
        LOAD_FROM_STORAGE: 'loadFromStorage'
    },
    
    // タイムアウト設定
    TIMEOUTS: {
        CONTEXT_MENU_SELECTION: 5000, // 5秒
        SERVICE_WORKER_RETRY: 2000, // 2秒
        STATUS_MESSAGE_DISPLAY: 3000 // 3秒
    },
    
    // 制限値
    LIMITS: {
        MAX_CUSTOM_COLORS: 8,
        MAX_COLOR_NAME_LENGTH: 10,
        MAX_RETRIES: 3,
        HIGHLIGHT_ELEMENT_SEARCH_DEPTH: 5
    }
};
