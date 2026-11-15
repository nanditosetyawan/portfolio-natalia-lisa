const fs = require('fs');
const filePath = 'src/pages/admin/AdminEdit.vue';
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `function selectPreviewEntity(event: MouseEvent): void {
  if (selectionBoxMoved) {
    selectionBoxMoved = false
    return
  }
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-object-id]')
  const entityId = target?.dataset.editorObjectId
  if (!entityId || !target) return
  event.preventDefault()
  if ((event.target as HTMLElement).closest('a')) event.stopPropagation()
  selectEntity(entityId, target, event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'additive' : 'replace')
}`;

const replacement1 = `function clearSelection(): void {
  if (inlineTextEdit.value) void commitInlineTextEdit()
  if (!editor.selectedObjectId && !editor.selectedObjectIds.length) return
  editor.clearSelection()
  selectedPreviewElement = null
  updateSelectedOutline()
  markSessionChanged()
}

function selectPreviewEntity(event: MouseEvent): void {
  if (selectionBoxMoved) return
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-object-id]')
  const entityId = target?.dataset.editorObjectId
  if (!entityId || !target) {
    clearSelection()
    return
  }
  event.preventDefault()
  if ((event.target as HTMLElement).closest('a')) event.stopPropagation()
  selectEntity(entityId, target, event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'additive' : 'replace')
}

function handleCanvasScrollClick(event: MouseEvent): void {
  if (selectionBoxMoved || isPanning.value || event.button !== 0) return
  if (canvasScroll.value && event.target === canvasScroll.value) {
    if (event.offsetX > canvasScroll.value.clientWidth || event.offsetY > canvasScroll.value.clientHeight) return
  }
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-object-id]')
  if (!target) clearSelection()
}`;

const target2 = `<div ref="canvasScroll" class="canvas-scroll" data-lenis-prevent :class="{ 'is-panning': isPanning }" @scroll="persistPreviewScroll" @wheel="handleCanvasWheel" @pointerdown="beginCanvasPan">`;
const replacement2 = `<div ref="canvasScroll" class="canvas-scroll" data-lenis-prevent :class="{ 'is-panning': isPanning }" @scroll="persistPreviewScroll" @wheel="handleCanvasWheel" @pointerdown="beginCanvasPan" @click="handleCanvasScrollClick">`;

// Handle CRLF vs LF matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget1 = target1.replace(/\r\n/g, '\n');
const normalizedTarget2 = target2.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedTarget1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
if (!normalizedContent.includes(normalizedTarget2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}

// Perform replacement while preserving original line endings
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

const crlfTarget1 = normalizedTarget1.replace(/\n/g, eol);
const crlfReplacement1 = replacement1.replace(/\r?\n/g, eol);
const crlfTarget2 = normalizedTarget2.replace(/\n/g, eol);
const crlfReplacement2 = replacement2.replace(/\r?\n/g, eol);

content = content.replace(crlfTarget1, crlfReplacement1);
content = content.replace(crlfTarget2, crlfReplacement2);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated AdminEdit.vue, isCRLF:', isCRLF);

