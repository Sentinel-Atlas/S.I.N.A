import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

export interface ParsedDocument {
  title: string;
  text: string;
  metadata: Record<string, unknown>;
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const basename = path.basename(filePath, path.extname(filePath));

  switch (ext) {
    case 'pdf':    return parsePdf(filePath, basename);
    case 'docx':   return parseDocx(filePath, basename);
    case 'html':
    case 'htm':    return parseHtml(filePath, basename);
    case 'md':
    case 'markdown': return parseMarkdown(filePath, basename);
    case 'txt':    return parseTxt(filePath, basename);
    case 'csv':    return parseCsv(filePath, basename);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

export function isSupportedFileType(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return ['pdf', 'docx', 'html', 'htm', 'md', 'markdown', 'txt', 'csv'].includes(ext);
}

async function parsePdf(filePath: string, title: string): Promise<ParsedDocument> {
  // Dynamic import to handle missing module gracefully
  const { default: pdfParse } = await import('pdf-parse');
  const data = fs.readFileSync(filePath);
  const result = await pdfParse(data);
  return {
    title: result.info?.Title || title,
    text: result.text,
    metadata: { pages: result.numpages, info: result.info },
  };
}

async function parseDocx(filePath: string, title: string): Promise<ParsedDocument> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return {
    title,
    text: result.value,
    metadata: { messages: result.messages },
  };
}

async function parseHtml(filePath: string, title: string): Promise<ParsedDocument> {
  const { load } = await import('cheerio');
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = load(html);

  // Extract title from <title> tag if available
  const htmlTitle = $('title').first().text().trim() || title;

  // Remove script, style, nav, footer, header elements
  $('script, style, nav, footer, header, aside').remove();

  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return {
    title: htmlTitle,
    text,
    metadata: { source_html: true },
  };
}

async function parseMarkdown(filePath: string, title: string): Promise<ParsedDocument> {
  const { marked } = await import('marked');
  const { load } = await import('cheerio');
  const md = fs.readFileSync(filePath, 'utf-8');

  // Extract title from first H1
  const h1Match = md.match(/^#\s+(.+)$/m);
  const docTitle = h1Match?.[1]?.trim() || title;

  // Strip markdown for plain text
  const html = await marked(md);
  const $ = load(html as string);
  const text = $.text().replace(/\s+/g, ' ').trim();

  return { title: docTitle, text, metadata: {} };
}

function parseTxt(filePath: string, title: string): ParsedDocument {
  const text = fs.readFileSync(filePath, 'utf-8');
  return { title, text: text.replace(/\s+/g, ' ').trim(), metadata: {} };
}

async function parseCsv(filePath: string, title: string): Promise<ParsedDocument> {
  const { parse } = await import('csv-parse/sync');
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];

  // Convert CSV rows to readable text
  const text = records.map(row =>
    Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | ')
  ).join('\n');

  return { title, text, metadata: { row_count: records.length } };
}

export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start += chunkSize - overlap;
    if (start >= words.length) break;
  }

  return chunks.filter(c => c.trim().length > 0);
}
