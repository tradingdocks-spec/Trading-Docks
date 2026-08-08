import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as ts from 'typescript';

import {
  calculateDealDeskOffer,
  createDealDeskRenderState,
  routeStoreAccountToDealDesk,
  sessionNameForMode,
  sessionTypeForMode,
} from '../services/deal-desk.ts';

const nativeHostTags = new Set(['View', 'Pressable', 'ScrollView', 'SafeAreaView', 'KeyboardAvoidingView', 'TouchableOpacity']);

test('Deal Desk remains a contextual route outside the primary tab bar', () => {
  assert.equal(routeStoreAccountToDealDesk(), '/deal-desk');
});

test('Deal Desk route has no direct raw text children in native host components', () => {
  const issues = findRawNativeTextChildren(join(process.cwd(), 'app', 'deal-desk.tsx'));
  assert.deepEqual(issues, []);
});

test('active native routes have no direct raw text children in native host components', () => {
  const routeFiles = collectTsxFiles(join(process.cwd(), 'app'))
    .filter((file) => !file.includes(`${join('app', 'dev')}${separatorFor(file)}`));
  const issues = routeFiles.flatMap(findRawNativeTextChildren);
  assert.deepEqual(issues, []);
});

test('Deal Desk empty state renders without requiring an active session', () => {
  const state = createDealDeskRenderState({
    ready: true,
    activeSession: null,
    mode: 'buy',
    market: '684.20',
    rate: '65',
    budget: '3000',
  });
  assert.equal(state.status, 'empty');
  assert.equal(state.offerLabel, '$444.73');
});

test('Deal Desk populated session render state includes active session details', () => {
  const state = createDealDeskRenderState({
    ready: true,
    activeSession: { name: 'Card show session', status: 'active' },
    mode: 'show',
    market: '100',
    rate: '60',
    budget: '500',
  });
  assert.equal(state.status, 'populated');
  assert.equal(state.activeSessionName, 'Card show session');
  assert.equal(state.activeSessionStatus, 'active');
});

test('Deal Desk missing-price state renders without inventing an offer', () => {
  const state = createDealDeskRenderState({
    ready: true,
    activeSession: null,
    mode: 'buy',
    market: '',
    rate: '65',
    budget: '3000',
  });
  assert.equal(state.missingPrice, true);
  assert.equal(state.offerValue, null);
  assert.equal(state.offerLabel, 'Pricing unavailable');
});

test('Deal Desk offer totals render from market rate and budget', () => {
  const totals = calculateDealDeskOffer({ market: '200', rate: '65', budget: '3000' });
  assert.equal(totals.offer, 130);
  assert.equal(totals.remaining, 2870);
});

test('Deal Desk loading and error states render explicitly', () => {
  assert.equal(createDealDeskRenderState({ ready: false, activeSession: null, mode: 'buy', market: '100', rate: '65', budget: '3000' }).status, 'loading');
  assert.equal(createDealDeskRenderState({ ready: true, activeSession: null, mode: 'buy', market: '100', rate: '65', budget: '3000', error: 'Failed' }).status, 'error');
});

test('Deal Desk session mode mapping preserves scanner-session behavior', () => {
  assert.equal(sessionNameForMode('buy'), 'New buying session');
  assert.equal(sessionNameForMode('trade'), 'New trade');
  assert.equal(sessionNameForMode('sealed'), 'Sealed evaluation');
  assert.equal(sessionNameForMode('show'), 'Card show session');
  assert.equal(sessionTypeForMode('buy'), 'buying');
  assert.equal(sessionTypeForMode('trade'), 'trade');
  assert.equal(sessionTypeForMode('sealed'), 'buying');
  assert.equal(sessionTypeForMode('show'), 'card-show');
});

function collectTsxFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return collectTsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

function findRawNativeTextChildren(filePath: string) {
  const sourceText = readFileSync(filePath, 'utf8');
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const issues: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(source);
      if (nativeHostTags.has(tagName)) {
        node.children.forEach((child) => {
          if (ts.isJsxText(child) && isMeaningfulRawText(child.getFullText(source))) {
            issues.push(formatIssue(filePath, child, source, 'raw JSX text'));
          }
          if (ts.isJsxExpression(child) && child.expression && expressionCanRenderRawText(child.expression)) {
            issues.push(formatIssue(filePath, child, source, 'raw string expression'));
          }
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return issues;
}

function expressionCanRenderRawText(expression: ts.Expression): boolean {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return true;
  if (ts.isConditionalExpression(expression)) {
    return expressionCanRenderRawText(expression.whenTrue) || expressionCanRenderRawText(expression.whenFalse);
  }
  if (ts.isParenthesizedExpression(expression)) return expressionCanRenderRawText(expression.expression);
  return false;
}

function isMeaningfulRawText(value: string) {
  return value.length > 0 && !value.includes('\n');
}

function formatIssue(filePath: string, node: ts.Node, source: ts.SourceFile, reason: string) {
  const location = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `${relative(process.cwd(), filePath)}:${location.line + 1}:${location.character + 1} ${reason}`;
}

function separatorFor(filePath: string) {
  return filePath.includes('\\') ? '\\' : '/';
}
