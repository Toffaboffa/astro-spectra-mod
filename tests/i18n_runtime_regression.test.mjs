import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/i18nUi.js'), 'utf8');

function element(id, ownerDocument) {
  return {
    nodeType: 1,
    id: id || '',
    ownerDocument,
    parentElement: null,
    children: [],
    attrs: Object.create(null),
    closest() { return null; },
    matches() { return false; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); },
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    querySelectorAll() { return []; }
  };
}

function textNode(value, parent, ownerDocument) {
  return {
    nodeType: 3,
    nodeValue: value,
    parentElement: parent,
    ownerDocument
  };
}

const nodes = Object.create(null);
const document = {
  documentElement: { lang: 'en' },
  title: 'SpectraPRO - Spectroscopy',
  getElementById(id) { return nodes[id] || null; },
  createTreeWalker(rootNode) {
    const flat = [];
    (function visit(node) {
      flat.push(node);
      if (node && Array.isArray(node.children)) node.children.forEach(visit);
    })(rootNode);
    let index = 0;
    return {
      currentNode: flat[0],
      nextNode() {
        index += 1;
        return flat[index] || null;
      }
    };
  }
};

const app = element('appContainer', document);
const pause = textNode('Pause', app, document);
app.children.push(pause);
nodes.appContainer = app;

const context = {
  console,
  document: null,
  NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
  location: {
    href: 'https://example.test/spectrapro.html?foo=bar&experiment=argon',
    search: '?foo=bar&experiment=argon'
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'i18nUi.js' });

assert.ok(context.SpectraPro && context.SpectraPro.i18n, 'modern i18n API must initialize without the legacy loader');
assert.equal(context.SpectraPro.i18n.getLanguage(), 'en', 'English must remain the initial interface language');

const originalHref = context.location.href;
const originalSearch = context.location.search;
context.document = document;

context.SpectraPro.i18n.setLanguage('sv');
assert.equal(context.SpectraPro.i18n.getLanguage(), 'sv', 'SV switch must activate Swedish');
assert.equal(document.documentElement.lang, 'sv', 'document language must follow the active interface language');
assert.equal(pause.nodeValue, 'Pausa', 'static English UI text must translate through i18nUi');

context.SpectraPro.i18n.setLanguage('en');
assert.equal(context.SpectraPro.i18n.getLanguage(), 'en', 'EN switch must restore English');
assert.equal(document.documentElement.lang, 'en');
assert.equal(pause.nodeValue, 'Pause', 'switching back to English must restore the original UI text');

assert.equal(context.location.href, originalHref, 'language switching must not redirect or replace the current URL');
assert.equal(context.location.search, originalSearch, 'unrelated query parameters must survive language switching untouched');
assert.ok(!source.includes('URLSearchParams'), 'modern i18n must not reintroduce query-parameter language routing');
assert.ok(!source.includes('window.location') && !source.includes('global.location'), 'modern i18n must not perform URL redirects');

console.log('I18N RUNTIME REGRESSION: EN/SV translation/restoration works without URL mutation or legacy language assets.');
