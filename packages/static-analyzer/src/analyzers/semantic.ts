/**
 * Semantic structure analyzer.
 *
 * Looks at HTML files for the kinds of structural problems that make a page
 * unusable with a screen reader or keyboard even when individual elements
 * technically work:
 *
 *   - Missing `<title>` (2.4.2 Page Titled)
 *   - Missing, empty, or duplicate `<main>` landmark (1.3.1 Info and Relationships)
 *   - Heading hierarchy skips (1.3.1)
 *   - `<ul>` / `<ol>` containing non-`<li>` children (1.3.1)
 *   - `<table>` without `<th>` or `<caption>` (1.3.1)
 *   - `<img>` missing `alt` attribute (1.1.1 Non-text Content)
 *   - Missing `<html lang="...">` (3.1.1 Language of Page)
 */

import { load, type CheerioAPI } from 'cheerio';

import { requireSuccessCriterion, type WcagFinding } from '@sdet-wcag-toolkit/core';

import { createFinding } from '../finding.js';
import type { Analyzer, SourceFile } from '../types.js';

export const semanticAnalyzer: Analyzer = {
  name: 'semantic-structure',
  analyze(context) {
    const findings: WcagFinding[] = [];
    for (const file of context.html) {
      findings.push(...analyzeHtmlFile(file));
    }
    return findings;
  },
};

function analyzeHtmlFile(file: SourceFile): WcagFinding[] {
  const $ = load(file.content);
  const findings: WcagFinding[] = [];

  findings.push(...checkDocumentTitle($, file));
  findings.push(...checkHtmlLang($, file));
  findings.push(...checkMainLandmark($, file));
  findings.push(...checkHeadingOrder($, file));
  findings.push(...checkListStructure($, file));
  findings.push(...checkTableStructure($, file));
  findings.push(...checkImageAlt($, file));

  return findings;
}

function checkDocumentTitle($: CheerioAPI, file: SourceFile): WcagFinding[] {
  const title = $('head > title').first().text().trim();
  if (title) return [];
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('2.4.2'),
      severity: 'serious',
      ruleId: 'document-title',
      message: 'Document is missing a non-empty <title>.',
      rationale:
        'Screen readers announce the page title on load. A missing or empty title leaves users without a way to identify the page.',
      remediation: 'Add <title>Your descriptive page name</title> inside <head>.',
      location: { file: file.path, selector: 'head > title' },
    }),
  ];
}

function checkHtmlLang($: CheerioAPI, file: SourceFile): WcagFinding[] {
  const lang = $('html').attr('lang');
  if (lang && lang.trim()) return [];
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('3.1.1'),
      severity: 'serious',
      ruleId: 'html-lang',
      message: '<html> is missing a non-empty "lang" attribute.',
      rationale:
        'Screen readers use the lang attribute to pick the correct pronunciation rules. Without it, content may be spoken in the wrong language.',
      remediation: 'Add a language tag to <html>, e.g. <html lang="en"> or <html lang="pl">.',
      location: { file: file.path, selector: 'html' },
    }),
  ];
}

function checkMainLandmark($: CheerioAPI, file: SourceFile): WcagFinding[] {
  const mains = $('main, [role="main"]');
  if (mains.length === 1) return [];

  if (mains.length === 0) {
    return [
      createFinding({
        successCriterion: requireSuccessCriterion('1.3.1'),
        severity: 'serious',
        ruleId: 'landmark-main',
        message: 'Document has no <main> landmark.',
        rationale:
          'Landmarks let assistive tech users jump straight to the primary content. Without <main> they must tab through everything.',
        remediation: 'Wrap the primary content of the page in <main>...</main>.',
        location: { file: file.path, selector: 'body' },
      }),
    ];
  }

  return [
    createFinding({
      successCriterion: requireSuccessCriterion('1.3.1'),
      severity: 'moderate',
      ruleId: 'landmark-unique',
      message: `Document has ${mains.length} elements with role=main; only one is allowed.`,
      rationale:
        'Multiple main landmarks confuse assistive tech - there is meant to be exactly one primary content region per page.',
      remediation: 'Keep one <main> and convert the rest to <section> or remove the role="main".',
      location: { file: file.path, selector: 'main, [role="main"]' },
    }),
  ];
}

function checkHeadingOrder($: CheerioAPI, file: SourceFile): WcagFinding[] {
  const headings = $('h1, h2, h3, h4, h5, h6').toArray();
  const findings: WcagFinding[] = [];
  let previousLevel = 0;

  for (const h of headings) {
    const tag = 'tagName' in h ? (h.tagName as string) : '';
    const level = Number.parseInt(tag.substring(1), 10);
    if (!Number.isFinite(level)) continue;
    if (previousLevel > 0 && level > previousLevel + 1) {
      findings.push(
        createFinding({
          successCriterion: requireSuccessCriterion('1.3.1'),
          severity: 'moderate',
          ruleId: 'heading-order',
          message: `Heading level skipped: jumped from h${previousLevel} to h${level}.`,
          rationale:
            'Heading levels communicate document structure. Skipping levels makes the outline incoherent for screen reader users.',
          remediation: `Use h${previousLevel + 1} instead of h${level}, or add an intermediate heading.`,
          location: { file: file.path, selector: `h${level}` },
        }),
      );
    }
    previousLevel = level;
  }

  return findings;
}

function checkListStructure($: CheerioAPI, file: SourceFile): WcagFinding[] {
  const findings: WcagFinding[] = [];
  $('ul, ol').each((_, list) => {
    const parentTag = 'tagName' in list ? (list.tagName as string) : 'ul';
    const invalidChildren = $(list)
      .children()
      .filter((_i, c) => {
        const name = 'tagName' in c ? (c.tagName as string).toLowerCase() : '';
        return name !== 'li' && name !== 'script' && name !== 'template';
      });
    if (invalidChildren.length === 0) return;
    findings.push(
      createFinding({
        successCriterion: requireSuccessCriterion('1.3.1'),
        severity: 'moderate',
        ruleId: 'list-structure',
        message: `<${parentTag}> contains ${invalidChildren.length} non-<li> children.`,
        rationale:
          'Lists must contain only list items. Other wrappers break the semantics that assistive tech relies on to announce list length and position.',
        remediation:
          'Wrap every direct child in <li>, or use a different grouping element if this is not actually a list.',
        location: { file: file.path, selector: parentTag },
      }),
    );
  });
  return findings;
}

function checkTableStructure($: CheerioAPI, file: SourceFile): WcagFinding[] {
  const findings: WcagFinding[] = [];
  $('table').each((_, table) => {
    const hasHeaders = $(table).find('th').length > 0;
    const hasCaption = $(table).find('caption').length > 0;
    const isPresentational =
      $(table).attr('role') === 'presentation' || $(table).attr('role') === 'none';
    if (isPresentational || hasHeaders) return;
    findings.push(
      createFinding({
        successCriterion: requireSuccessCriterion('1.3.1'),
        severity: 'serious',
        ruleId: 'table-headers',
        message: hasCaption
          ? '<table> has a <caption> but no <th> cells.'
          : '<table> has no <th> or <caption>.',
        rationale:
          'Data tables need at least one <th> (or a <caption> + headers) so screen readers can announce row/column relationships.',
        remediation:
          'Mark the header row/column with <th> and scope="row|col", or add role="presentation" if the table is layout-only.',
        location: { file: file.path, selector: 'table' },
      }),
    );
  });
  return findings;
}

function checkImageAlt($: CheerioAPI, file: SourceFile): WcagFinding[] {
  const findings: WcagFinding[] = [];
  $('img').each((_, img) => {
    const alt = $(img).attr('alt');
    // Explicitly empty alt="" IS valid (decorative image). Missing attribute is not.
    if (typeof alt === 'string') return;
    const src = $(img).attr('src') ?? '(no src)';
    findings.push(
      createFinding({
        successCriterion: requireSuccessCriterion('1.1.1'),
        severity: 'serious',
        ruleId: 'image-alt',
        message: `<img src="${src}"> is missing the alt attribute.`,
        rationale:
          'Screen readers fall back to the filename (or skip the image) when alt is missing. Even decorative images need alt="" to be explicitly silent.',
        remediation:
          'Add alt="descriptive text" for meaningful images, or alt="" (empty) for decorative ones.',
        location: { file: file.path, selector: `img[src="${src}"]` },
      }),
    );
  });
  return findings;
}
