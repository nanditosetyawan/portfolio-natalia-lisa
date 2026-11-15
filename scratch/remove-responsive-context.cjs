const fs = require('fs');
const filePath = 'src/pages/admin/AdminEdit.vue';
let content = fs.readFileSync(filePath, 'utf8');

const targetTemplate = `      <div class="responsive-inspector-context" data-responsive-inspector>
        <span>Editing</span>
        <strong>{{ activeViewportLabel }}</strong>
        <small>{{ activeBreakpoint === 'desktop' ? 'Set the main design for larger screens.' : 'Using Desktop values until you make a Tablet change.' }}</small>
      </div>\r\n\r\n`;

const targetTemplateLF = `      <div class="responsive-inspector-context" data-responsive-inspector>
        <span>Editing</span>
        <strong>{{ activeViewportLabel }}</strong>
        <small>{{ activeBreakpoint === 'desktop' ? 'Set the main design for larger screens.' : 'Using Desktop values until you make a Tablet change.' }}</small>
      </div>\n\n`;

if (content.includes(targetTemplate)) {
  content = content.replace(targetTemplate, '');
} else if (content.includes(targetTemplateLF)) {
  content = content.replace(targetTemplateLF, '');
} else {
  // Try line by line replacement
  const normalized = content.replace(/\r\n/g, '\n');
  const targetNorm = `      <div class="responsive-inspector-context" data-responsive-inspector>\n        <span>Editing</span>\n        <strong>{{ activeViewportLabel }}</strong>\n        <small>{{ activeBreakpoint === 'desktop' ? 'Set the main design for larger screens.' : 'Using Desktop values until you make a Tablet change.' }}</small>\n      </div>\n`;
  if (normalized.includes(targetNorm)) {
    const isCRLF = content.includes('\r\n');
    const eol = isCRLF ? '\r\n' : '\n';
    const crlfTarget = targetNorm.replace(/\n/g, eol);
    content = content.replace(crlfTarget, '');
  } else {
    console.error('Target template block not found!');
    process.exit(1);
  }
}

// Also remove CSS rule
const targetCss = `.responsive-inspector-context { display: grid; grid-template-columns: 1fr auto; gap: .18rem .65rem; margin-top: .65rem; padding: .65rem .72rem; border: 1px solid rgba(184,91,105,.2); border-radius: 11px; background: linear-gradient(135deg,rgba(255,245,235,.92),rgba(255,253,247,.86)); color: #80675d; font-size: .62rem; }.responsive-inspector-context > span { font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }.responsive-inspector-context strong { color: #9b4f5b; }.responsive-inspector-context small { grid-column: 1 / -1; color: #92796d; line-height: 1.4; }`;

if (content.includes(targetCss)) {
  content = content.replace(targetCss, '');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully removed responsive inspector context from AdminEdit.vue');

