/**
 * @OnlyCurrentDoc
 */ 
var MERMAID_IMAGE_MAX_WIDTH_RATIO = 1;
var DOCUMENT_POINTS_TO_IMAGE_PIXELS = 2;
var DEFAULT_DOCUMENT_CONTENT_WIDTH = 1200;

function onInstall() {
  onOpen(); 
}

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Mermaid')
    .addItem('New chart', 'addNewChart')
    .addItem('Edit selected chart', 'editSelectedChart')
    .addItem('Paste from markdown', 'openPasteMarkdownDialog')
    .addToUi();
}

 
function addNewChart(){
  var selected=findSelectedImage()
  if(selected){
    DocumentApp.getUi().alert('You have a chart selected, please unselect it first, or click "edit" to edit it.');
  }else{
    openDialog("graph LR\n  A -->B", 'Insert',"")
  }
}
  

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

function openDialog(source,label,theme, currentWidth=0) {
  var imageLayout = getDocumentImageLayoutConfig();

  var html = HtmlService.createHtmlOutputFromFile('index')
    .setWidth(3000)
    .setHeight(2000)
    .append(`<script>
      window.graphDataFromGoogle=${JSON.stringify({source,label,theme, currentWidth, maxImageWidth: imageLayout.maxWidth, maxImageWidthRatio: imageLayout.widthRatio})}
    </script>`) ;


  DocumentApp.getUi()
      .showModalDialog(html, 'Graph editor')
}

function openPasteMarkdownDialog() {
  var imageLayout = getDocumentImageLayoutConfig();
  var html = HtmlService.createHtmlOutputFromFile('paste_markdown')
    .setWidth(960)
    .setHeight(720)
    .append(`<script>
      window.mermaidImageLayoutFromGoogle=${JSON.stringify(imageLayout)}
    </script>`);

  DocumentApp.getUi()
    .showModalDialog(html, 'Paste from markdown');
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
  var lines = String(block.text || '').split('\n');
  if (!lines.length) {
    lines = [''];
  }

  lines.forEach(function(line) {
    var paragraph = body.insertParagraph(index, line);
    var text = paragraph.editAsText();
    var lineLength = line.length;

    applyQuoteIndent_(paragraph, (block.quoteDepth || 0) + 1);

    if (lineLength > 0) {
      text.setFontFamily(0, lineLength - 1, 'Courier New');
      text.setBackgroundColor(0, lineLength - 1, '#f1f3f4');
    }

    index += 1;
  });

  return index;
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
      textElement.setFontFamily(start, end, 'Courier New');
      textElement.setBackgroundColor(start, end, '#f1f3f4');
    }

    offset += text.length;
  });
}