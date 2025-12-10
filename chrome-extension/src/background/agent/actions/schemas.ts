import { z } from 'zod';

export interface ActionSchema {
  name: string;
  description: string;
  schema: z.ZodType;
}

export const doneActionSchema: ActionSchema = {
  name: 'done',
  description: 'Complete task',
  schema: z.object({
    text: z.string(),
    success: z.boolean(),
  }),
};

// Basic Navigation Actions
export const searchGoogleActionSchema: ActionSchema = {
  name: 'search_google',
  description:
    'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    query: z.string(),
  }),
};

export const goToUrlActionSchema: ActionSchema = {
  name: 'go_to_url',
  description: 'Navigate to URL in the current tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string(),
  }),
};

export const goBackActionSchema: ActionSchema = {
  name: 'go_back',
  description: 'Go back to the previous page',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
  }),
};

export const clickElementActionSchema: ActionSchema = {
  name: 'click_element',
  description: 'Click element by index',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const inputTextActionSchema: ActionSchema = {
  name: 'input_text',
  description: 'Input text into an interactive input element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    text: z.string().describe('text to input'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

// Tab Management Actions
export const switchTabActionSchema: ActionSchema = {
  name: 'switch_tab',
  description: 'Switch to tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab to switch to'),
  }),
};

export const openTabActionSchema: ActionSchema = {
  name: 'open_tab',
  description: 'Open URL in new tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string().describe('url to open'),
  }),
};

export const closeTabActionSchema: ActionSchema = {
  name: 'close_tab',
  description: 'Close tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab'),
  }),
};

// Content Actions, not used currently
// export const extractContentActionSchema: ActionSchema = {
//   name: 'extract_content',
//   description:
//     'Extract page content to retrieve specific information from the page, e.g. all company names, a specific description, all information about, links with companies in structured format or simply links',
//   schema: z.object({
//     goal: z.string(),
//   }),
// };

// Cache Actions
export const cacheContentActionSchema: ActionSchema = {
  name: 'cache_content',
  description: 'Cache what you have found so far from the current page for future use',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    content: z.string().default('').describe('content to cache'),
  }),
};

export const scrollToPercentActionSchema: ActionSchema = {
  name: 'scroll_to_percent',
  description:
    'Scrolls to a particular vertical percentage of the document or an element. If no index of element is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    yPercent: z.number().int().describe('percentage to scroll to - min 0, max 100; 0 is top, 100 is bottom'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToTopActionSchema: ActionSchema = {
  name: 'scroll_to_top',
  description: 'Scroll the document in the window or an element to the top',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToBottomActionSchema: ActionSchema = {
  name: 'scroll_to_bottom',
  description: 'Scroll the document in the window or an element to the bottom',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const previousPageActionSchema: ActionSchema = {
  name: 'previous_page',
  description:
    'Scroll the document in the window or an element to the previous page. If no index is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const nextPageActionSchema: ActionSchema = {
  name: 'next_page',
  description:
    'Scroll the document in the window or an element to the next page. If no index is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToTextActionSchema: ActionSchema = {
  name: 'scroll_to_text',
  description: 'If you dont find something which you want to interact with in current viewport, try to scroll to it',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    text: z.string().describe('text to scroll to'),
    nth: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe('which occurrence of the text to scroll to (1-indexed, default: 1)'),
  }),
};

export const sendKeysActionSchema: ActionSchema = {
  name: 'send_keys',
  description:
    'Send strings of special keys like Backspace, Insert, PageDown, Delete, Enter. Shortcuts such as `Control+o`, `Control+Shift+T` are supported as well. This gets used in keyboard press. Be aware of different operating systems and their shortcuts',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    keys: z.string().describe('keys to send'),
  }),
};

export const getDropdownOptionsActionSchema: ActionSchema = {
  name: 'get_dropdown_options',
  description: 'Get all options from a native dropdown',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
  }),
};

export const selectDropdownOptionActionSchema: ActionSchema = {
  name: 'select_dropdown_option',
  description: 'Select dropdown option for interactive element index by the text of the option you want to select',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
    text: z.string().describe('text of the option'),
  }),
};

export const waitActionSchema: ActionSchema = {
  name: 'wait',
  description: 'Wait for x seconds default 3, do NOT use this action unless user asks to wait explicitly',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    seconds: z.number().int().default(3).describe('amount of seconds'),
  }),
};

// ============================================
// PHASE 1: ENHANCED ACTIONS
// ============================================

// Advanced Mouse Actions
export const hoverElementActionSchema: ActionSchema = {
  name: 'hover_element',
  description: 'Hover over an element to reveal dropdowns, tooltips, or hidden menus',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
    duration: z.number().int().default(500).describe('hover duration in milliseconds'),
  }),
};

export const doubleClickElementActionSchema: ActionSchema = {
  name: 'double_click_element',
  description: 'Double-click an element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const rightClickElementActionSchema: ActionSchema = {
  name: 'right_click_element',
  description: 'Right-click an element to open context menu',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const dragAndDropActionSchema: ActionSchema = {
  name: 'drag_and_drop',
  description: 'Drag an element and drop it onto another element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    sourceIndex: z.number().int().describe('index of the source element to drag'),
    targetIndex: z.number().int().describe('index of the target element to drop onto'),
    sourceXpath: z.string().nullable().optional().describe('xpath of source element'),
    targetXpath: z.string().nullable().optional().describe('xpath of target element'),
  }),
};

export const clickCoordinatesActionSchema: ActionSchema = {
  name: 'click_coordinates',
  description: 'Click at specific x, y coordinates. Use this as a fallback when element selection fails.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    x: z.number().int().describe('x coordinate'),
    y: z.number().int().describe('y coordinate'),
  }),
};

// File Upload Action
export const uploadFileActionSchema: ActionSchema = {
  name: 'upload_file',
  description: 'Upload a file to a file input element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the file input element'),
    filePath: z.string().describe('path to the file to upload'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

// Keyboard Actions
export const pressKeyActionSchema: ActionSchema = {
  name: 'press_key',
  description: 'Press a specific key or key combination (e.g., Enter, Escape, Control+C)',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    key: z.string().describe('key to press (e.g., Enter, Escape, Tab)'),
    modifiers: z
      .array(z.enum(['Control', 'Shift', 'Alt', 'Meta']))
      .optional()
      .describe('modifier keys to hold'),
  }),
};

// Text Selection Actions
export const selectTextActionSchema: ActionSchema = {
  name: 'select_text',
  description: 'Select text within an element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

// Validation Actions
export const assertVisibleActionSchema: ActionSchema = {
  name: 'assert_visible',
  description: 'Assert that an element is visible on the page',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const assertTextActionSchema: ActionSchema = {
  name: 'assert_text',
  description: 'Assert that an element contains specific text',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    expectedText: z.string().describe('expected text content'),
    exact: z.boolean().default(false).describe('whether to match exactly or partially'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

// Cookie Management Actions
export const getCookiesActionSchema: ActionSchema = {
  name: 'get_cookies',
  description: 'Get all cookies or a specific cookie by name',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    name: z.string().optional().describe('name of specific cookie to get'),
  }),
};

export const setCookieActionSchema: ActionSchema = {
  name: 'set_cookie',
  description: 'Set a cookie with specified name and value',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    name: z.string().describe('cookie name'),
    value: z.string().describe('cookie value'),
    domain: z.string().optional().describe('cookie domain'),
    path: z.string().default('/').describe('cookie path'),
  }),
};
