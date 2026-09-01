/**
SETUP INSTRUCTIONS FOR CONSUMING PROJECTS

When using this as a library, the consuming project must include ALL of these wrapper functions
to enable the menu items and HTML dialogs to work. Add the following to your consuming project's script:

// Get reference to the mermaid-gdocs library
var MermaidManager = ...;  // Replace ... with your library identifier

// Menu callbacks (referenced by string name in createMenu()):

function onOpen() { MermaidManager.createMenu(); }
function addNewChart() { MermaidManager.addNewChart(); }
function editSelectedChart() { MermaidManager.editSelectedChart(); }
function openPasteMarkdownDialog() { MermaidManager.openPasteMarkdownDialog(); }
function openThemeDialog() { MermaidManager.openThemeDialog(); }
function insertImage(source, theme, base64, width, height) { return MermaidManager.insertImage(source, theme, base64, width, height); }
function insertMarkdownBlocks(blocks) { return MermaidManager.insertMarkdownBlocks(blocks); }
function setImageFrameConfig(config) { return MermaidManager.setImageFrameConfig(config); }
function getImageFrameConfig() { return MermaidManager.getImageFrameConfig(); }
function getMermaidThemeConfig() { return MermaidManager.getMermaidThemeConfig(); }
function saveMermaidCustomTheme(theme) { return MermaidManager.saveMermaidCustomTheme(theme); }
function deleteMermaidCustomTheme(id) { return MermaidManager.deleteMermaidCustomTheme(id); }

These wrappers are necessary because google.script.run can only access functions
defined in the consuming project's own script, not library functions directly.
 */

function onOpen() {
  createMenu();
}

/**
 * @public
**/
function createMenu() {
  DocumentApp.getUi()
    .createMenu('Mermaid')
    .addItem('New chart', 'addNewChart')
    .addItem('Edit selected chart', 'editSelectedChart')
    .addItem('Paste from markdown', 'openPasteMarkdownDialog')
    .addItem('Manage themes', 'openThemeDialog')
    .addToUi();
}

/**
 * @public
**/
function addNewChart(){
  var selected=findSelectedImage()
  if(selected){
    DocumentApp.getUi().alert('You have a chart selected, please unselect it first, or click "edit" to edit it.');
  }else{
    openDialog("graph LR\n  A -->B", 'Insert',"")
  }
}

/**
 * @public
**/
function editSelectedChart(){
  var selected=findSelectedImage()
  if(!selected){
    DocumentApp.getUi().alert('Please select an existing chart created with this app first. Make sure the graph image placement is "in line" or it will not work.');
  }else{
    let source=selected.getAltDescription();
    let theme= selected.getAltTitle().replace('mermaid-graph/','') || ""

    try{
      // backward compat
      const decoded=JSON.parse(source);
      if(decoded.source){
        source=decoded.source
      }
      if(decoded.theme){
        theme=decoded.theme
      }
    }catch(e){
    }

    openDialog(source, 'Update', theme, selected.getWidth())
  }
}

/**
 * @public
**/
function openPasteMarkdownDialog() {
  var imageLayout = getDocumentImageLayoutConfig();
  var html = HtmlService.createHtmlOutputFromFile('paste_markdown')
    .setWidth(960)
    .setHeight(720)
    .append(`<script>
      window.mermaidImageLayoutFromGoogle=${jsonForHtml_(imageLayout)}
      window.mermaidThemeDataFromGoogle=${jsonForHtml_(getMermaidThemeConfig())}
    </script>`);

  DocumentApp.getUi()
    .showModalDialog(html, 'Paste from markdown');
}
/**
 * @public
**/
function openThemeDialog() {
  var html = HtmlService.createHtmlOutputFromFile('theme_settings')
    .setWidth(960)
    .setHeight(680)
    .append(`<script>
      window.mermaidThemeDataFromGoogle=${jsonForHtml_(getMermaidThemeConfig())}
    </script>`);

  DocumentApp.getUi()
    .showModalDialog(html, 'Mermaid themes');
}

/**
 * @OnlyCurrentDoc
 */ 
var MERMAID_IMAGE_MAX_WIDTH_RATIO = 1;
var DOCUMENT_POINTS_TO_IMAGE_PIXELS = 2;
var DEFAULT_DOCUMENT_CONTENT_WIDTH = 1200;
var MERMAID_CUSTOM_THEMES_PROPERTY = 'mermaidCustomThemes';
var MERMAID_THEME_STORAGE_MAX_LENGTH = 8000;
var MERMAID_THEME_NAME_MAX_LENGTH = 60;
var MERMAID_THEME_VARIABLES_MAX_KEYS = 150;
var MERMAID_THEME_VARIABLE_STRING_MAX_LENGTH = 500;
var MERMAID_BUILT_IN_THEMES = [
  { id: 'default', name: 'Default', mermaidTheme: 'default' },
  { id: 'forest', name: 'Forest', mermaidTheme: 'forest' },
  { id: 'dark', name: 'Dark', mermaidTheme: 'dark' },
  { id: 'neutral', name: 'Neutral', mermaidTheme: 'neutral' },
  { id: 'base', name: 'Base', mermaidTheme: 'base' },
];
var MARKDOWN_CODE_STYLE = {
  background: '#f1f3f4',
  borderColor: '#dadce0',
  borderWidth: 1,
  text: '#202124',
  keyword: '#0b57d0',
  type: '#9334e6',
  string: '#188038',
  number: '#b06000',
  comment: '#5f6368',
  fontFamily: 'Courier New',
  fontSize: 11,
  padding: 6,
  marginBefore: 6,
  marginAfter: 6,
};
var MARKDOWN_INLINE_CODE_STYLE = {
  color: '#188038',
  fontFamily: 'Roboto Mono',
};
var MARKDOWN_TABLE_STYLE = {
  borderColor: '#dadce0',
  borderWidth: 1,
  widthMultiplier: 1.5,
  headerBackground: '#e8eaed',
  headerTextColor: '#202124',
  bodyTextColor: '#3c4043',
  zebraBackground: '#fdfdfe',
  fontSize: 10,
  lineSpacing: 1.15,
  paragraphSpacing: 2,
};

function openDialog(source,label,theme, currentWidth=0) {
  var imageLayout = getDocumentImageLayoutConfig();

  var html = HtmlService.createHtmlOutputFromFile('index')
    .setWidth(3000)
    .setHeight(2000)
    .append(`<script>
      window.graphDataFromGoogle=${jsonForHtml_({source,label,theme, currentWidth, maxImageWidth: imageLayout.maxWidth, maxImageWidthRatio: imageLayout.widthRatio})}
      window.mermaidThemeDataFromGoogle=${jsonForHtml_(getMermaidThemeConfig())}
    </script>`) ;


  DocumentApp.getUi()
      .showModalDialog(html, 'Graph editor')
}

function jsonForHtml_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
/**
 * @public
 **/
function getMermaidThemeConfig() {
  var customThemes = getMermaidCustomThemes_();
  return {
    builtInThemes: MERMAID_BUILT_IN_THEMES.map(function(theme) {
      return {
        id: theme.id,
        name: theme.name,
        mermaidTheme: theme.mermaidTheme,
        custom: false,
      };
    }),
    customThemes: customThemes,
    themes: MERMAID_BUILT_IN_THEMES.map(function(theme) {
      return {
        id: theme.id,
        name: theme.name,
        mermaidTheme: theme.mermaidTheme,
        custom: false,
      };
    }).concat(customThemes.map(function(theme) {
      return {
        id: theme.id,
        name: theme.name,
        mermaidTheme: 'base',
        themeVariables: theme.themeVariables,
        custom: true,
      };
    })),
  };
}

/**
 * @public
 **/
function saveMermaidCustomTheme(theme) {
  var existingThemes = getMermaidCustomThemes_();
  var name = sanitizeMermaidThemeName_(theme && theme.name);
  var themeVariables = sanitizeMermaidThemeVariables_(theme && theme.themeVariables);
  var requestedId = sanitizeMermaidCustomThemeId_(theme && theme.id);
  var id = requestedId || createUniqueMermaidThemeId_(name, existingThemes);
  var savedTheme = {
    id: id,
    name: name,
    themeVariables: themeVariables,
  };
  var didReplace = false;

  existingThemes = existingThemes.map(function(existingTheme) {
    if (existingTheme.id === id) {
      didReplace = true;
      return savedTheme;
    }
    return existingTheme;
  });

  if (!didReplace) {
    if (existingThemes.some(function(existingTheme) { return existingTheme.id === id; })) {
      savedTheme.id = createUniqueMermaidThemeId_(name, existingThemes);
    }
    existingThemes.push(savedTheme);
  }

  persistMermaidCustomThemes_(existingThemes);
  return {
    savedTheme: savedTheme,
    config: getMermaidThemeConfig(),
  };
}

/**
 * @public
 **/
function deleteMermaidCustomTheme(id) {
  var themeId = sanitizeMermaidCustomThemeId_(id);
  if (!themeId) {
    throw new Error('Select a custom theme to delete.');
  }

  var themes = getMermaidCustomThemes_().filter(function(theme) {
    return theme.id !== themeId;
  });

  persistMermaidCustomThemes_(themes);
  return getMermaidThemeConfig();
}

function getMermaidCustomThemes_() {
  var stored = PropertiesService.getUserProperties().getProperty(MERMAID_CUSTOM_THEMES_PROPERTY);
  if (!stored) {
    return [];
  }

  try {
    var parsed = JSON.parse(stored);
    var themes = Array.isArray(parsed) ? parsed : parsed.themes;
    if (!Array.isArray(themes)) {
      return [];
    }

    return themes.map(function(theme) {
      try {
        return sanitizeStoredMermaidCustomTheme_(theme);
      } catch (e) {
        return null;
      }
    }).filter(function(theme) {
      return !!theme;
    });
  } catch (e) {
    return [];
  }
}

function sanitizeStoredMermaidCustomTheme_(theme) {
  var name = sanitizeMermaidThemeName_(theme && theme.name);
  var id = sanitizeMermaidCustomThemeId_(theme && theme.id) || createMermaidCustomThemeId_(name);

  return {
    id: id,
    name: name,
    themeVariables: sanitizeMermaidThemeVariables_(theme && theme.themeVariables),
  };
}

function sanitizeMermaidThemeName_(name) {
  var sanitizedName = String(name || '').replace(/\s+/g, ' ').trim();
  if (!sanitizedName) {
    throw new Error('Theme name is required.');
  }
  if (sanitizedName.length > MERMAID_THEME_NAME_MAX_LENGTH) {
    throw new Error('Theme name must be ' + MERMAID_THEME_NAME_MAX_LENGTH + ' characters or less.');
  }
  return sanitizedName;
}

function sanitizeMermaidCustomThemeId_(id) {
  var themeId = String(id || '').trim().toLowerCase();
  if (!themeId) {
    return '';
  }
  if (!/^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(themeId)) {
    return '';
  }
  return themeId;
}

function createMermaidCustomThemeId_(name) {
  var slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    slug = 'theme';
  }

  return 'custom:' + slug;
}

function createUniqueMermaidThemeId_(name, existingThemes) {
  var baseId = createMermaidCustomThemeId_(name);
  var id = baseId;
  var suffix = 2;
  var existingIds = {};

  (existingThemes || []).forEach(function(theme) {
    existingIds[theme.id] = true;
  });

  while (existingIds[id]) {
    id = baseId + '-' + suffix;
    suffix += 1;
  }

  return id;
}

function sanitizeMermaidThemeVariables_(themeVariables) {
  var variables = themeVariables;
  if (typeof variables === 'string') {
    try {
      variables = JSON.parse(variables);
    } catch (e) {
      throw new Error('Theme variables must be valid JSON.');
    }
  }

  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
    throw new Error('Theme variables must be a JSON object.');
  }

  var sanitized = {};
  var keys = Object.keys(variables);
  if (keys.length > MERMAID_THEME_VARIABLES_MAX_KEYS) {
    throw new Error('Theme variables cannot contain more than ' + MERMAID_THEME_VARIABLES_MAX_KEYS + ' keys.');
  }

  keys.forEach(function(key) {
    var sanitizedKey = String(key || '').trim();
    var value = variables[key];

    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(sanitizedKey)) {
      throw new Error('Theme variable "' + key + '" is not a valid Mermaid variable name.');
    }

    if (typeof value === 'string') {
      if (value.length > MERMAID_THEME_VARIABLE_STRING_MAX_LENGTH) {
        throw new Error('Theme variable "' + sanitizedKey + '" is too long.');
      }
      sanitized[sanitizedKey] = value;
      return;
    }

    if (typeof value === 'number') {
      if (!isFinite(value)) {
        throw new Error('Theme variable "' + sanitizedKey + '" must be a finite number.');
      }
      sanitized[sanitizedKey] = value;
      return;
    }

    if (typeof value === 'boolean') {
      sanitized[sanitizedKey] = value;
      return;
    }

    throw new Error('Theme variable "' + sanitizedKey + '" must be a string, number, or boolean.');
  });

  return sanitized;
}

function persistMermaidCustomThemes_(themes) {
  var sanitizedThemes = (themes || []).map(function(theme) {
    return sanitizeStoredMermaidCustomTheme_(theme);
  });
  var serialized = JSON.stringify(sanitizedThemes);

  if (serialized.length > MERMAID_THEME_STORAGE_MAX_LENGTH) {
    throw new Error('Theme storage is full. Delete unused themes or reduce theme variables.');
  }

  PropertiesService.getUserProperties().setProperty(MERMAID_CUSTOM_THEMES_PROPERTY, serialized);
}

function getDocumentImageLayoutConfig() {
  var contentWidth = getDocumentContentWidth_();
  return {
    maxWidth: Math.max(1, Math.floor(contentWidth * MERMAID_IMAGE_MAX_WIDTH_RATIO)),
    widthRatio: MERMAID_IMAGE_MAX_WIDTH_RATIO,
  };
}

function getDocumentContentWidth_() {
  try {
    var body = getActiveBody_(DocumentApp.getActiveDocument());
    var pageWidth = body.getPageWidth && body.getPageWidth();
    var marginLeft = body.getMarginLeft && body.getMarginLeft();
    var marginRight = body.getMarginRight && body.getMarginRight();
    var contentWidth = (Number(pageWidth) - Number(marginLeft) - Number(marginRight)) * DOCUMENT_POINTS_TO_IMAGE_PIXELS;

    if (isFinite(contentWidth) && contentWidth > 0) {
      return contentWidth;
    }
  } catch (e) {
  }

  return DEFAULT_DOCUMENT_CONTENT_WIDTH;
}

/**
 * @public
 **/
function getImageFrameConfig() {
  var defaults = {
    borderWidth: 1,
    borderColor: '#000000',
    padding: 0,
  };

  var userProps = PropertiesService.getUserProperties();
  var stored = userProps.getProperty('mermaidImageFrameConfig');
  if (!stored) {
    return defaults;
  }

  try {
    var parsed = JSON.parse(stored);
    var config = sanitizeImageFrameConfig_(parsed || {});
    return {
      borderWidth: config.borderWidth,
      borderColor: config.borderColor,
      padding: config.padding,
    };
  } catch (e) {
    return defaults;
  }
}

/**
 * @public
 **/
function setImageFrameConfig(config) {
  var sanitized = sanitizeImageFrameConfig_(config || {});
  var userProps = PropertiesService.getUserProperties();
  userProps.setProperty('mermaidImageFrameConfig', JSON.stringify(sanitized));
  return sanitized;
}

function sanitizeImageFrameConfig_(config) {
  var borderWidth = Number(config.borderWidth);
  var padding = Number(config.padding);
  var borderColor = String(config.borderColor || '').trim();

  if (!isFinite(borderWidth)) {
    borderWidth = 1;
  }
  if (!isFinite(padding)) {
    padding = 0;
  }

  borderWidth = Math.max(0, Math.min(24, Math.round(borderWidth)));
  padding = Math.max(0, Math.min(64, Math.round(padding)));

  if (!/^#([0-9a-fA-F]{6})$/.test(borderColor)) {
    borderColor = '#000000';
  }

  return {
    borderWidth: borderWidth,
    borderColor: borderColor.toLowerCase(),
    padding: padding,
  };
}


function findSelectedImage(){

  try{
    return DocumentApp.getActiveDocument().getSelection()
      ?.getRangeElements()
      ?.map(rangeElement=>rangeElement.getElement())
      .find(element=>element.getType()==DocumentApp.ElementType.INLINE_IMAGE &&  element.asInlineImage().getAltTitle()?.startsWith('mermaid-graph'))
      ?.asInlineImage()
  }catch(e){
    DocumentApp.getUi().alert('It looks like you are trying to use this addon with multiple google accounts'+
    ' logged in. Only the "default" account (the one shown when you open google) will work here,'+
    ' because of a limitation of google docs. You can either open this page in a private navigation, or change'+
    ' the default account. To change the default account, log out of all accounts, then log in with the desired'+
    ' default account first. Sorry for the inconvenience, it is an issue out of our control. ');
  }

}

/**
 * @public
 **/
function insertImage(source, theme, base64,width, height){
  var blob=Utilities.newBlob(Utilities.base64Decode(base64.split(',')[1]), 'image/png', "mermaid-chart.png");
  var selected=findSelectedImage();

  if (selected) {
    var selectedTable = findParentTableFromInlineImage_(selected);
    if (selectedTable && isSingleCellTable_(selectedTable)) {
      var document = DocumentApp.getActiveDocument();
      var body = getActiveBody_(document);
      var selectedTopLevel = findTopLevelBodyChild_(selectedTable, body) || findTopLevelBodyChild_(selected, body);
      if (selectedTopLevel) {
        var selectedIndex = getBodyChildIndex_(body, selectedTopLevel);
        selectedTopLevel.removeFromParent();
        insertInlineImageParagraphAt_(body, selectedIndex, blob, width, height, source, theme, 0);
        return;
      }
    }

    var replacement = replaceInlineImage_(selected, blob);
    applyMermaidImageProperties_(replacement, width, height, source, theme);
    centerInlineImageParagraph_(replacement);
    return;
  }

  var document = DocumentApp.getActiveDocument();
  var body = getActiveBody_(document);
  var index = getMarkdownInsertionIndex_(document, body);

  insertInlineImageParagraphAt_(body, index, blob, width, height, source, theme, 0);

}

/**
 * @public
 **/
function insertMarkdownBlocks(blocks) {
  if (!blocks || !blocks.length) {
    throw new Error('No markdown content to insert.');
  }

  var document = DocumentApp.getActiveDocument();
  var body = getActiveBody_(document);
  var index = getMarkdownInsertionIndex_(document, body);
  var insertedCount = 0;

  blocks.forEach(function(block) {
    var nextIndex = insertMarkdownBlock_(body, index, block || {});
    if (nextIndex > index) {
      insertedCount += (nextIndex - index);
    }
    index = nextIndex;
  });

  if (!insertedCount) {
    throw new Error('The markdown parsed successfully, but no supported content could be inserted.');
  }

  return insertedCount;
}

function getActiveBody_(document) {
  if (document.getActiveTab) {
    var activeTab = document.getActiveTab();
    if (activeTab && activeTab.asDocumentTab) {
      var documentTab = activeTab.asDocumentTab();
      if (documentTab && documentTab.getBody) {
        return documentTab.getBody();
      }
    }
  }

  return document.getBody();
}

function getMarkdownInsertionIndex_(document, body) {
  var cursor = document.getCursor();
  if (!cursor) {
    return body.getNumChildren();
  }

  var topLevelElement = findTopLevelBodyChild_(cursor.getElement(), body);
  if (!topLevelElement) {
    return body.getNumChildren();
  }

  try {
    return body.getChildIndex(topLevelElement) + 1;
  } catch (e) {
    var parent = topLevelElement.getParent && topLevelElement.getParent();
    if (parent && parent.getType && parent.getType() === DocumentApp.ElementType.BODY_SECTION) {
      return parent.getChildIndex(topLevelElement) + 1;
    }
    return body.getNumChildren();
  }
}

function getBodyChildIndex_(body, element) {
  try {
    return body.getChildIndex(element);
  } catch (e) {
    var parent = element.getParent && element.getParent();
    if (parent && parent.getType && parent.getType() === DocumentApp.ElementType.BODY_SECTION) {
      return parent.getChildIndex(element);
    }
    return body.getNumChildren();
  }
}

function findTopLevelBodyChild_(element, body) {
  var current = element;
  while (current && current.getParent && current.getParent()) {
    var parent = current.getParent();
    if (parent === body) {
      return current;
    }

    // Object identity between body instances is not always stable; stop at BODY_SECTION.
    if (parent.getType && parent.getType() === DocumentApp.ElementType.BODY_SECTION) {
      return current;
    }

    current = parent;
  }

  return null;
}

function insertMarkdownBlock_(body, index, block) {
  switch (block.type) {
    case 'heading':
      return insertMarkdownParagraph_(body, index, block, true);
    case 'paragraph':
      return insertMarkdownParagraph_(body, index, block, false);
    case 'list_item':
      return insertMarkdownListItem_(body, index, block);
    case 'code':
      return insertMarkdownCodeBlock_(body, index, block);
    case 'mermaid':
      return insertMarkdownMermaidBlock_(body, index, block);
    case 'table':
      return insertMarkdownTable_(body, index, block);
    case 'rule':
      return insertMarkdownRule_(body, index, block);
    default:
      if (block.inlines && block.inlines.length) {
        return insertMarkdownParagraph_(body, index, {
          type: 'paragraph',
          inlines: block.inlines,
          quoteDepth: block.quoteDepth || 0,
        }, false);
      }
      return index;
  }
}

function insertMarkdownParagraph_(body, index, block, isHeading) {
  var textContent = buildInlineText_(block.inlines || []);
  var paragraph = body.insertParagraph(index, textContent);

  if (isHeading) {
    paragraph.setHeading(getHeadingForLevel_(block.level));
  }

  applyQuoteIndent_(paragraph, block.quoteDepth || 0);
  applyInlineStyles_(paragraph.editAsText(), block.inlines || []);
  return index + 1;
}

function insertMarkdownListItem_(body, index, block) {
  var textContent = buildInlineText_(block.inlines || []);
  var listItem = body.insertListItem(index, textContent);

  listItem.setNestingLevel(block.nestingLevel || 0);
  listItem.setGlyphType(block.ordered ? DocumentApp.GlyphType.NUMBER : DocumentApp.GlyphType.BULLET);

  applyQuoteIndent_(listItem, block.quoteDepth || 0);
  applyInlineStyles_(listItem.editAsText(), block.inlines || []);
  return index + 1;
}

function insertMarkdownCodeBlock_(body, index, block) {
  var code = String(block.text || '');
  var language = normalizeMarkdownCodeLanguage_(block.language);
  var quoteDepth = block.quoteDepth || 0;

  insertMarkdownCodeMarginParagraph_(body, index, quoteDepth, 'before');
  index += 1;

  var table = body.insertTable(index, [[code || ' ']]);
  var cell = table.getCell(0, 0);
  var text = cell.editAsText();
  var textValue = text.getText();

  applyMarkdownCodeBlockTableStyle_(table, cell, quoteDepth);

  if (textValue) {
    applyMarkdownCodeBaseStyle_(text, textValue.length);
    applyMarkdownCodeSyntaxStyles_(text, textValue, language);
  }

  index += 1;
  insertMarkdownCodeMarginParagraph_(body, index, quoteDepth, 'after');
  return index + 1;
}

function insertMarkdownCodeMarginParagraph_(body, index, quoteDepth, position) {
  var paragraph = body.insertParagraph(index, '');
  applyQuoteIndent_(paragraph, quoteDepth || 0);

  if (typeof paragraph.setSpacingBefore === 'function') {
    paragraph.setSpacingBefore(position === 'after' ? MARKDOWN_CODE_STYLE.marginAfter : 0);
  }
  if (typeof paragraph.setSpacingAfter === 'function') {
    paragraph.setSpacingAfter(position === 'before' ? MARKDOWN_CODE_STYLE.marginBefore : 0);
  }
  if (typeof paragraph.setLineSpacing === 'function') {
    paragraph.setLineSpacing(1);
  }

  return paragraph;
}

function applyMarkdownCodeBlockTableStyle_(table, cell, quoteDepth) {
  if (typeof table.setBorderColor === 'function') {
    table.setBorderColor(MARKDOWN_CODE_STYLE.borderColor);
  }
  if (typeof table.setBorderWidth === 'function') {
    table.setBorderWidth(MARKDOWN_CODE_STYLE.borderWidth);
  }

  if (typeof cell.setBackgroundColor === 'function') {
    cell.setBackgroundColor(MARKDOWN_CODE_STYLE.background);
  }
  setMarkdownCodeCellPadding_(cell, MARKDOWN_CODE_STYLE.padding);

  for (var childIndex = 0; childIndex < cell.getNumChildren(); childIndex += 1) {
    var child = cell.getChild(childIndex);
    if (child.getType && child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var paragraph = child.asParagraph();
      applyMarkdownCodeParagraphStyle_(paragraph);
      applyQuoteIndent_(paragraph, quoteDepth || 0);
    }
  }
}

function setMarkdownCodeCellPadding_(cell, padding) {
  [
    'setPaddingTop',
    'setPaddingRight',
    'setPaddingBottom',
    'setPaddingLeft',
  ].forEach(function(methodName) {
    if (typeof cell[methodName] === 'function') {
      cell[methodName](padding);
    }
  });
}

function applyMarkdownCodeParagraphStyle_(paragraph) {
  if (typeof paragraph.setSpacingBefore === 'function') {
    paragraph.setSpacingBefore(0);
  }
  if (typeof paragraph.setSpacingAfter === 'function') {
    paragraph.setSpacingAfter(0);
  }
  if (typeof paragraph.setLineSpacing === 'function') {
    paragraph.setLineSpacing(1);
  }
}

function normalizeMarkdownCodeLanguage_(language) {
  var codeLanguage = String(language || '').trim().split(/\s+/)[0].toLowerCase();
  switch (codeLanguage) {
    case 'js':
    case 'javascript':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'typescript':
    case 'tsx':
      return 'typescript';
    default:
      return codeLanguage;
  }
}

function isJavascriptOrTypescriptLanguage_(language) {
  return language === 'javascript' || language === 'typescript';
}

function applyMarkdownCodeBaseStyle_(text, textLength) {
  var end = textLength - 1;
  text.setFontFamily(0, end, MARKDOWN_CODE_STYLE.fontFamily);
  text.setForegroundColor(0, end, MARKDOWN_CODE_STYLE.text);
  text.setFontSize(0, end, MARKDOWN_CODE_STYLE.fontSize);
}

function applyMarkdownCodeSyntaxStyles_(text, code, language) {
  if (!isJavascriptOrTypescriptLanguage_(language)) {
    return;
  }

  var syntaxState = {};
  var offset = 0;
  String(code || '').split('\n').forEach(function(line) {
    if (line.length > 0) {
      applyJavascriptTypescriptSyntaxStyle_(text, line, language, syntaxState, offset);
    } else if (syntaxState.inBlockComment || syntaxState.inTemplateString) {
      applyJavascriptTypescriptSyntaxStyle_(text, line, language, syntaxState, offset);
    }
    offset += line.length + 1;
  });
}

function applyJavascriptTypescriptSyntaxStyle_(text, line, language, syntaxState, baseOffset) {
  baseOffset = Number(baseOffset) || 0;
  var occupiedRanges = [];
  var index = 0;

  while (index < line.length) {
    if (syntaxState.inBlockComment) {
      var blockCommentEnd = line.indexOf('*/', index);
      var blockEnd = blockCommentEnd === -1 ? line.length - 1 : blockCommentEnd + 1;
      applyMarkdownCodeRangeStyle_(text, baseOffset + index, baseOffset + blockEnd, {
        color: MARKDOWN_CODE_STYLE.comment,
        italic: true,
      });
      addOccupiedRange_(occupiedRanges, index, blockEnd);

      if (blockCommentEnd === -1) {
        return;
      }

      syntaxState.inBlockComment = false;
      index = blockEnd + 1;
      continue;
    }

    if (syntaxState.inTemplateString) {
      var templateEnd = findJsTsStringEnd_(line, index - 1, '`');
      var templateRangeEnd = templateEnd === -1 ? line.length - 1 : templateEnd;
      applyMarkdownCodeRangeStyle_(text, baseOffset + index, baseOffset + templateRangeEnd, {
        color: MARKDOWN_CODE_STYLE.string,
      });
      addOccupiedRange_(occupiedRanges, index, templateRangeEnd);

      if (templateEnd === -1) {
        return;
      }

      syntaxState.inTemplateString = false;
      index = templateRangeEnd + 1;
      continue;
    }

    var current = line.charAt(index);
    var next = line.charAt(index + 1);

    if (current === '/' && next === '/') {
      applyMarkdownCodeRangeStyle_(text, baseOffset + index, baseOffset + line.length - 1, {
        color: MARKDOWN_CODE_STYLE.comment,
        italic: true,
      });
      addOccupiedRange_(occupiedRanges, index, line.length - 1);
      break;
    }

    if (current === '/' && next === '*') {
      var commentEnd = line.indexOf('*/', index + 2);
      var commentRangeEnd = commentEnd === -1 ? line.length - 1 : commentEnd + 1;
      applyMarkdownCodeRangeStyle_(text, baseOffset + index, baseOffset + commentRangeEnd, {
        color: MARKDOWN_CODE_STYLE.comment,
        italic: true,
      });
      addOccupiedRange_(occupiedRanges, index, commentRangeEnd);
      syntaxState.inBlockComment = commentEnd === -1;
      index = commentRangeEnd + 1;
      continue;
    }

    if (current === '"' || current === "'" || current === '`') {
      var stringEnd = findJsTsStringEnd_(line, index, current);
      var stringRangeEnd = stringEnd === -1 ? line.length - 1 : stringEnd;
      applyMarkdownCodeRangeStyle_(text, baseOffset + index, baseOffset + stringRangeEnd, {
        color: MARKDOWN_CODE_STYLE.string,
      });
      addOccupiedRange_(occupiedRanges, index, stringRangeEnd);
      syntaxState.inTemplateString = current === '`' && stringEnd === -1;
      index = stringRangeEnd + 1;
      continue;
    }

    index += 1;
  }

  applyRegexStyleToUnoccupiedRanges_(
    text,
    line,
    /\b(?:0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/gi,
    { color: MARKDOWN_CODE_STYLE.number },
    occupiedRanges,
    baseOffset
  );
  applyRegexStyleToUnoccupiedRanges_(
    text,
    line,
    getJsTsKeywordRegex_(),
    { color: MARKDOWN_CODE_STYLE.keyword, bold: true },
    occupiedRanges,
    baseOffset
  );

  if (language === 'typescript') {
    applyRegexStyleToUnoccupiedRanges_(
      text,
      line,
      getTypescriptTypeKeywordRegex_(),
      { color: MARKDOWN_CODE_STYLE.type, bold: true },
      occupiedRanges,
      baseOffset
    );
  }
}

function findJsTsStringEnd_(line, startIndex, quote) {
  for (var index = startIndex + 1; index < line.length; index += 1) {
    if (line.charAt(index) === '\\') {
      index += 1;
      continue;
    }
    if (line.charAt(index) === quote) {
      return index;
    }
  }

  return -1;
}

function getJsTsKeywordRegex_() {
  return /\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield)\b/g;
}

function getTypescriptTypeKeywordRegex_() {
  return /\b(?:abstract|any|as|bigint|boolean|declare|enum|implements|infer|interface|is|keyof|module|namespace|never|number|object|private|protected|public|readonly|satisfies|string|symbol|type|unknown)\b/g;
}

function applyRegexStyleToUnoccupiedRanges_(text, line, regex, style, occupiedRanges, baseOffset) {
  var match;
  baseOffset = Number(baseOffset) || 0;
  regex.lastIndex = 0;

  while ((match = regex.exec(line)) !== null) {
    var start = match.index;
    var end = start + match[0].length - 1;
    if (isRangeUnoccupied_(occupiedRanges, start, end)) {
      applyMarkdownCodeRangeStyle_(text, baseOffset + start, baseOffset + end, style);
      addOccupiedRange_(occupiedRanges, start, end);
    }
  }
}

function isRangeUnoccupied_(occupiedRanges, start, end) {
  return !(occupiedRanges || []).some(function(range) {
    return start <= range.end && end >= range.start;
  });
}

function addOccupiedRange_(occupiedRanges, start, end) {
  if (start > end) {
    return;
  }
  occupiedRanges.push({
    start: start,
    end: end,
  });
}

function applyMarkdownCodeRangeStyle_(text, start, end, style) {
  if (start > end) {
    return;
  }

  if (style.color) {
    text.setForegroundColor(start, end, style.color);
  }
  if (style.bold) {
    text.setBold(start, end, true);
  }
  if (style.italic) {
    text.setItalic(start, end, true);
  }
}

function insertMarkdownMermaidBlock_(body, index, block) {
  if (!block.base64) {
    throw new Error('A Mermaid block is missing its rendered PNG data.');
  }

  insertInlineImageParagraphAt_(
    body,
    index,
    createPngBlobFromBase64_(block.base64),
    block.width,
    block.height,
    block.source || '',
    block.theme || 'default',
    block.quoteDepth || 0
  );

  return index + 1;
}

function insertInlineImageParagraphAt_(body, index, blob, width, height, source, theme, quoteDepth) {
  var paragraph = body.insertParagraph(index, '');
  var image = paragraph.appendInlineImage(blob);

  applyMermaidImageProperties_(image, width, height, source, theme);
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  if (quoteDepth) {
    applyQuoteIndent_(paragraph, quoteDepth);
  }

  return image;
}

function applyMermaidImageProperties_(image, width, height, source, theme) {
  image.setAltDescription(source || '');
  image.setAltTitle('mermaid-graph/' + (theme || 'default'));
  var displaySize = fitImageDimensionsToDocument_(width, height);

  if (displaySize.width) {
    image.setWidth(displaySize.width);
  }
  if (displaySize.height) {
    image.setHeight(displaySize.height);
  }

  return image;
}

function fitImageDimensionsToDocument_(width, height) {
  var numericWidth = Number(width);
  var numericHeight = Number(height);

  if (!isFinite(numericWidth) || numericWidth <= 0) {
    return {
      width: width,
      height: height,
    };
  }

  var maxWidth = getDocumentImageLayoutConfig().maxWidth;
  if (numericWidth <= maxWidth) {
    return {
      width: width,
      height: height,
    };
  }

  var scale = maxWidth / numericWidth;
  return {
    width: maxWidth,
    height: isFinite(numericHeight) && numericHeight > 0
      ? Math.max(1, Math.floor(numericHeight * scale))
      : height,
  };
}

function replaceInlineImage_(inlineImage, blob) {
  var parent = inlineImage.getParent();
  var inserted = parent.insertInlineImage(parent.getChildIndex(inlineImage) + 1, blob);
  inlineImage.removeFromParent();
  return inserted;
}

function findParentTableFromInlineImage_(inlineImage) {
  var current = inlineImage;
  while (current && current.getParent && current.getParent()) {
    var parent = current.getParent();
    if (parent.getType && parent.getType() === DocumentApp.ElementType.TABLE) {
      return parent.asTable();
    }
    current = parent;
  }

  return null;
}

function isSingleCellTable_(table) {
  try {
    return table.getNumRows() === 1 && table.getRow(0).getNumCells() === 1;
  } catch (e) {
    return false;
  }
}

function centerInlineImageParagraph_(inlineImage) {
  if (!inlineImage || !inlineImage.getParent) {
    return;
  }

  var parent = inlineImage.getParent();
  if (!parent || !parent.getType) {
    return;
  }

  var parentType = parent.getType();
  if (parentType === DocumentApp.ElementType.PARAGRAPH) {
    parent.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    return;
  }

  if (parentType === DocumentApp.ElementType.LIST_ITEM) {
    parent.asListItem().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }
}

function insertMarkdownRule_(body, index, block) {
  var paragraph = body.insertParagraph(index, '______________________________');
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  applyQuoteIndent_(paragraph, block.quoteDepth || 0);
  return index + 1;
}

function insertMarkdownTable_(body, index, block) {
  var headerCells = normalizeMarkdownTableCells_(block.header || []);
  var bodyRows = (block.rows || []).map(function(row) {
    return normalizeMarkdownTableCells_(row || []);
  });

  var rows = [];
  if (headerCells.length) {
    rows.push(headerCells);
  }

  bodyRows.forEach(function(row) {
    rows.push(row);
  });

  if (!rows.length) {
    return index;
  }

  var maxColumns = rows.reduce(function(max, row) {
    return Math.max(max, row.length);
  }, 0);

  if (!maxColumns) {
    return index;
  }

  rows = rows.map(function(row) {
    var normalized = row.slice();
    while (normalized.length < maxColumns) {
      normalized.push({ inlines: [], align: '' });
    }
    return normalized;
  });

  var tableText = rows.map(function(row) {
    return row.map(function(cell) {
      return buildInlineText_(cell.inlines || []);
    });
  });

  var table = body.insertTable(index, tableText);
  widenMarkdownTable_(table, maxColumns);
  applyMarkdownTableStyle_(table, rows.length, maxColumns);

  for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (var columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      var cellData = rows[rowIndex][columnIndex] || { inlines: [], align: '' };
      var cell = table.getCell(rowIndex, columnIndex);
      var text = cell.editAsText();
      applyMarkdownTableCellTypography_(text, rowIndex === 0);
      applyInlineStyles_(text, cellData.inlines || []);
      applyMarkdownTableCellAlignment_(cell, cellData.align);
    }
  }

  return index + 1;
}

function widenMarkdownTable_(table, columnCount) {
  if (!table || typeof table.getColumnWidth !== 'function' || typeof table.setColumnWidth !== 'function') {
    return;
  }

  for (var columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    table.setColumnWidth(
      columnIndex,
      table.getColumnWidth(columnIndex) * MARKDOWN_TABLE_STYLE.widthMultiplier
    );
  }
}

function normalizeMarkdownTableCells_(cells) {
  return (cells || []).map(function(cell) {
    return {
      inlines: cell && cell.inlines ? cell.inlines : [],
      align: cell && cell.align ? String(cell.align).toLowerCase() : '',
    };
  });
}

function applyMarkdownTableStyle_(table, rowCount, columnCount) {
  if (!table) {
    return;
  }

  if (typeof table.setBorderColor === 'function') {
    table.setBorderColor(MARKDOWN_TABLE_STYLE.borderColor);
  }
  if (typeof table.setBorderWidth === 'function') {
    table.setBorderWidth(MARKDOWN_TABLE_STYLE.borderWidth);
  }

  for (var rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (var columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      applyMarkdownTableCellVisualStyle_(table.getCell(rowIndex, columnIndex), rowIndex);
    }
  }
}

function applyMarkdownTableCellVisualStyle_(tableCell, rowIndex) {
  if (!tableCell) {
    return;
  }

  if (typeof tableCell.setBackgroundColor === 'function') {
    if (rowIndex === 0) {
      tableCell.setBackgroundColor(MARKDOWN_TABLE_STYLE.headerBackground);
    } else if (rowIndex % 2 === 0) {
      tableCell.setBackgroundColor(MARKDOWN_TABLE_STYLE.zebraBackground);
    }
  }

  var numChildren = tableCell.getNumChildren();
  for (var childIndex = 0; childIndex < numChildren; childIndex += 1) {
    var child = tableCell.getChild(childIndex);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var paragraph = child.asParagraph();
      if (typeof paragraph.setSpacingBefore === 'function') {
        paragraph.setSpacingBefore(MARKDOWN_TABLE_STYLE.paragraphSpacing);
      }
      if (typeof paragraph.setSpacingAfter === 'function') {
        paragraph.setSpacingAfter(MARKDOWN_TABLE_STYLE.paragraphSpacing);
      }
      if (typeof paragraph.setLineSpacing === 'function') {
        paragraph.setLineSpacing(MARKDOWN_TABLE_STYLE.lineSpacing);
      }
    }
  }
}

function applyMarkdownTableCellTypography_(textElement, isHeaderRow) {
  var textValue = textElement.getText();
  if (!textValue) {
    return;
  }

  var end = textValue.length - 1;
  textElement.setFontSize(0, end, MARKDOWN_TABLE_STYLE.fontSize);
  textElement.setForegroundColor(
    0,
    end,
    isHeaderRow ? MARKDOWN_TABLE_STYLE.headerTextColor : MARKDOWN_TABLE_STYLE.bodyTextColor
  );

  if (isHeaderRow) {
    textElement.setBold(0, end, true);
  }
}

function applyMarkdownTableCellAlignment_(tableCell, alignment) {
  var targetAlignment = null;
  switch (String(alignment || '').toLowerCase()) {
    case 'left':
      targetAlignment = DocumentApp.HorizontalAlignment.LEFT;
      break;
    case 'center':
      targetAlignment = DocumentApp.HorizontalAlignment.CENTER;
      break;
    case 'right':
      targetAlignment = DocumentApp.HorizontalAlignment.RIGHT;
      break;
    default:
      return;
  }

  var numChildren = tableCell.getNumChildren();
  for (var childIndex = 0; childIndex < numChildren; childIndex += 1) {
    var child = tableCell.getChild(childIndex);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      child.asParagraph().setAlignment(targetAlignment);
    }
  }
}

function createPngBlobFromBase64_(base64) {
  var parts = String(base64 || '').split(',');
  var data = parts.length > 1 ? parts[1] : parts[0];
  return Utilities.newBlob(Utilities.base64Decode(data), 'image/png', 'mermaid-chart.png');
}

function getHeadingForLevel_(level) {
  switch (level) {
    case 1:
      return DocumentApp.ParagraphHeading.HEADING1;
    case 2:
      return DocumentApp.ParagraphHeading.HEADING2;
    case 3:
      return DocumentApp.ParagraphHeading.HEADING3;
    case 4:
      return DocumentApp.ParagraphHeading.HEADING4;
    case 5:
      return DocumentApp.ParagraphHeading.HEADING5;
    default:
      return DocumentApp.ParagraphHeading.HEADING6;
  }
}

function applyQuoteIndent_(paragraphElement, quoteDepth) {
  if (!quoteDepth) {
    return;
  }

  var indent = quoteDepth * 18;
  paragraphElement.setIndentStart(indent);
  paragraphElement.setIndentFirstLine(indent);
}

function buildInlineText_(inlines) {
  return (inlines || []).map(function(inline) {
    return inline && inline.text ? inline.text : '';
  }).join('');
}

function applyInlineStyles_(textElement, inlines) {
  var offset = 0;

  (inlines || []).forEach(function(inline) {
    var text = inline && inline.text ? inline.text : '';
    if (!text) {
      return;
    }

    var start = offset;
    var end = offset + text.length - 1;

    if (inline.bold) {
      textElement.setBold(start, end, true);
    }
    if (inline.italic) {
      textElement.setItalic(start, end, true);
    }
    if (inline.strikethrough) {
      textElement.setStrikethrough(start, end, true);
    }
    if (inline.linkUrl) {
      textElement.setLinkUrl(start, end, inline.linkUrl);
    }
    if (inline.code) {
      textElement.setFontFamily(start, end, MARKDOWN_INLINE_CODE_STYLE.fontFamily);
      textElement.setForegroundColor(start, end, MARKDOWN_INLINE_CODE_STYLE.color);
    }
    if (inline.superscript) {
      textElement.setTextAlignment(start, end, DocumentApp.TextAlignment.SUPERSCRIPT);
    } else if (inline.subscript) {
      textElement.setTextAlignment(start, end, DocumentApp.TextAlignment.SUBSCRIPT);
    }

    offset += text.length;
  });
}
