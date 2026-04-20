#!/usr/bin/env node
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PUBMED_SEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_FETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const HEADERS = { 'User-Agent': 'AttachmentBrainBot/1.0 (research aggregator)' };

const SEARCH_QUERIES = [
  '("attachment"[Title/Abstract] OR "attachment theory"[Title/Abstract] OR "adult attachment"[Title/Abstract] OR "attachment security"[Title/Abstract] OR "attachment insecurity"[Title/Abstract]) AND english[Language]',
  '("romantic attachment"[Title/Abstract] OR "attachment anxiety"[Title/Abstract] OR "attachment avoidance"[Title/Abstract] OR "Experiences in Close Relationships"[Title/Abstract]) AND english[Language]',
  '("attachment insecurity"[Title/Abstract] OR "disorganized attachment"[Title/Abstract]) AND (depression[Title/Abstract] OR anxiety[Title/Abstract] OR PTSD[Title/Abstract] OR trauma[Title/Abstract] OR dissociation[Title/Abstract] OR "personality disorder"[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "disorganized attachment"[Title/Abstract]) AND (trauma[Title/Abstract] OR maltreatment[Title/Abstract] OR neglect[Title/Abstract] OR abuse[Title/Abstract] OR adversity[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "social bonding"[Title/Abstract] OR "pair bonding"[Title/Abstract]) AND (neurobiology[Title/Abstract] OR neuroimaging[Title/Abstract] OR fMRI[Title/Abstract] OR EEG[Title/Abstract] OR oxytocin[Title/Abstract] OR cortisol[Title/Abstract] OR dopamine[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "attachment style"[Title/Abstract]) AND (psychotherapy[Title/Abstract] OR "therapeutic alliance"[Title/Abstract] OR treatment[Title/Abstract] OR intervention[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "attachment insecurity"[Title/Abstract] OR "attachment anxiety"[Title/Abstract] OR "attachment avoidance"[Title/Abstract]) AND ("emotion regulation"[Title/Abstract] OR "affect regulation"[Title/Abstract] OR mentalization[Title/Abstract] OR mentalizing[Title/Abstract]) AND english[Language]',
  '("infant attachment"[Title/Abstract] OR ((infant*[Title/Abstract] OR child*[Title/Abstract]) AND (caregiver*[Title/Abstract] OR maternal[Title/Abstract] OR paternal[Title/Abstract]) AND attachment[Title/Abstract])) AND english[Language]',
  '("disorganized attachment"[Title/Abstract] OR "unresolved attachment"[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract]) AND ("borderline personality disorder"[Title/Abstract] OR BPD[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "disorganized attachment"[Title/Abstract]) AND (dissociation[Title/Abstract] OR dissociative[Title/Abstract]) AND english[Language]',
  '("adult attachment"[Title/Abstract] OR "romantic attachment"[Title/Abstract] OR "attachment anxiety"[Title/Abstract] OR "attachment avoidance"[Title/Abstract]) AND ("relationship satisfaction"[Title/Abstract] OR intimacy[Title/Abstract] OR conflict[Title/Abstract] OR couple*[Title/Abstract] OR marriage[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "social bonding"[Title/Abstract]) AND (oxytocin[Title/Abstract] OR vasopressin[Title/Abstract] OR cortisol[Title/Abstract] OR "HPA axis"[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "peer attachment"[Title/Abstract] OR "parent-adolescent relationship"[Title/Abstract]) AND (adolescen*[Title/Abstract] OR teen*[Title/Abstract] OR youth[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "attachment insecurity"[Title/Abstract]) AND (loneliness[Title/Abstract] OR "social isolation"[Title/Abstract] OR belongingness[Title/Abstract]) AND english[Language]',
  '(attachment[Title/Abstract] OR "Adult Attachment Interview"[Title/Abstract]) AND (intergenerational[Title/Abstract] OR transmission[Title/Abstract]) AND (parental[Title/Abstract] OR maternal[Title/Abstract] OR paternal[Title/Abstract]) AND english[Language]',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 7, maxPapers: 50, output: 'papers.json' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) opts.days = parseInt(args[++i]);
    else if (args[i] === '--max-papers' && args[i + 1]) opts.maxPapers = parseInt(args[++i]);
    else if (args[i] === '--output' && args[i + 1]) opts.output = args[++i];
  }
  return opts;
}

function addDateFilter(query, days) {
  const lookback = new Date(Date.now() - days * 86400000);
  const dateStr = `${lookback.getFullYear()}/${String(lookback.getMonth() + 1).padStart(2, '0')}/${String(lookback.getDate()).padStart(2, '0')}`;
  return `${query} AND "${dateStr}"[Date - Publication] : "3000"[Date - Publication]`;
}

async function searchPapers(query, retmax = 20) {
  const url = `${PUBMED_SEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&sort=date&retmode=json`;
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data?.esearchresult?.idlist || [];
  } catch (e) {
    console.error(`[WARN] PubMed search failed: ${e.message}`);
    return [];
  }
}

async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const url = `${PUBMED_FETCH}?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    return parseXml(xml);
  } catch (e) {
    console.error(`[ERROR] PubMed fetch failed: ${e.message}`);
    return [];
  }
}

function parseXml(xml) {
  const papers = [];
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;
  while ((match = articleRegex.exec(xml)) !== null) {
    const block = match[1];
    const pmid = extractTag(block, 'PMID');
    const title = extractTag(block, 'ArticleTitle');
    const journal = extractTag(block, '<Title>');
    const abstract = extractAbstract(block);
    const date = extractDate(block);
    const keywords = extractKeywords(block);
    papers.push({
      pmid,
      title,
      journal,
      date,
      abstract: abstract.slice(0, 2000),
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '',
      keywords,
    });
  }
  return papers;
}

function extractTag(block, tag) {
  const re = tag.startsWith('<')
    ? new RegExp(`${tag}([\\s\\S]*?)<\\/${tag.replace('<', '')}`, 'm')
    : new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'm');
  const m = block.match(re);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, '').trim();
}

function extractAbstract(block) {
  const parts = [];
  const re = /<AbstractText[^>]*Label="([^"]*)"[^>]*>([\s\S]*?)<\/AbstractText>/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const label = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (label && text) parts.push(`${label}: ${text}`);
    else if (text) parts.push(text);
  }
  if (!parts.length) {
    const plainRe = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
    while ((m = plainRe.exec(block)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text) parts.push(text);
    }
  }
  return parts.join(' ');
}

function extractDate(block) {
  const year = extractTag(block, 'Year') || '';
  const month = extractTag(block, 'Month') || '';
  const day = extractTag(block, 'Day') || '';
  return [year, month, day].filter(Boolean).join(' ');
}

function extractKeywords(block) {
  const kws = [];
  const re = /<Keyword>([\s\S]*?)<\/Keyword>/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const kw = m[1].trim();
    if (kw) kws.push(kw);
  }
  return kws;
}

function loadCollectedPmids() {
  const path = resolve(process.cwd(), 'collected_pmids.json');
  if (!existsSync(path)) return new Set();
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (Array.isArray(data)) {
      const cutoff = Date.now() - 30 * 86400000;
      const recent = data.filter(e => {
        if (typeof e === 'string') return true;
        return e.date && new Date(e.date).getTime() > cutoff;
      });
      const pmids = recent.map(e => typeof e === 'string' ? e : e.pmid);
      return new Set(pmids.filter(Boolean));
    }
  } catch {}
  return new Set();
}

function saveCollectedPmids(existingPmids, newPmids, dateStr) {
  const path = resolve(process.cwd(), 'collected_pmids.json');
  const all = new Set([...existingPmids, ...newPmids]);
  const entries = [...all].map(pmid => ({ pmid, date: dateStr }));
  writeFileSync(path, JSON.stringify(entries, null, 2), 'utf8');
  console.error(`[INFO] Updated collected_pmids.json: ${entries.length} total PMIDs`);
}

async function main() {
  const opts = parseArgs();
  console.error(`[INFO] Searching PubMed for attachment papers from last ${opts.days} days...`);

  const collectedPmids = loadCollectedPmids();
  console.error(`[INFO] Already collected: ${collectedPmids.size} PMIDs`);

  const allPmids = new Set();
  const perQuery = Math.ceil(opts.maxPapers / SEARCH_QUERIES.length);

  for (let i = 0; i < SEARCH_QUERIES.length; i++) {
    const query = addDateFilter(SEARCH_QUERIES[i], opts.days);
    const pmids = await searchPapers(query, perQuery);
    pmids.forEach(id => allPmids.add(id));
    console.error(`[INFO] Query ${i + 1}/${SEARCH_QUERIES.length}: found ${pmids.length} papers`);
    await new Promise(r => setTimeout(r, 400));
  }

  const newPmids = [...allPmids].filter(id => !collectedPmids.has(id));
  console.error(`[INFO] Total unique: ${allPmids.size}, New: ${newPmids.length}`);

  const pmidsToFetch = newPmids.slice(0, opts.maxPapers);
  let papers = [];
  if (pmidsToFetch.length) {
    papers = await fetchDetails(pmidsToFetch);
    console.error(`[INFO] Fetched details for ${papers.length} papers`);
  }

  const tz = new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
  const dateStr = new Date(tz).toISOString().slice(0, 10);

  const output = {
    date: dateStr,
    count: papers.length,
    papers,
  };

  const outStr = JSON.stringify(output, null, 2);
  writeFileSync(opts.output, outStr, 'utf8');
  console.error(`[INFO] Saved to ${opts.output}`);

  if (papers.length > 0) {
    const newPmidList = papers.map(p => p.pmid).filter(Boolean);
    saveCollectedPmids(collectedPmids, newPmidList, dateStr);
  }
}

main().catch(e => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
