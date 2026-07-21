/**
 * Lightweight client-side PDF text extraction (no deps).
 * Works for text-based PDFs (common hospital referral printouts).
 * Scanned image PDFs need OCR later — we surface a clear message then.
 */

export function looksLikePdf(file: File, head?: Uint8Array): boolean {
  if (file.type === 'application/pdf') return true;
  if (/\.pdf$/i.test(file.name)) return true;
  if (head && head.length >= 4) {
    return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  }
  return false;
}

export function looksLikeBinaryText(s: string): boolean {
  if (!s) return false;
  if (s.startsWith('%PDF')) return true;
  let bad = 0;
  const n = Math.min(s.length, 2000);
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c === 0 || (c < 9 && c !== 10 && c !== 13) || (c > 14 && c < 32 && c !== 9)) bad++;
  }
  return bad / n > 0.08;
}

/** Decode PDF literal string with basic escapes. */
function decodePdfString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}

/**
 * Extract readable strings from PDF binary (latin1 view of bytes).
 * Collects (... ) Tj and TJ array operands.
 */
export function extractTextFromPdfBytes(bytes: Uint8Array): string {
  // latin1 preserves byte→char 1:1 for ASCII operators
  let raw = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    raw += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }

  const parts: string[] = [];

  // (text) Tj or (text) '
  const tjRe = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw))) {
    const inner = m[0].replace(/\)\s*Tj$/, '').slice(1);
    const t = decodePdfString(inner).trim();
    if (t.length > 0) parts.push(t);
  }

  // [(text) n (text)] TJ
  const tjArrRe = /\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
  while ((m = tjArrRe.exec(raw))) {
    const body = m[1];
    const strRe = /\((?:\\.|[^\\)])*\)/g;
    let sm: RegExpExecArray | null;
    const line: string[] = [];
    while ((sm = strRe.exec(body))) {
      const inner = sm[0].slice(1, -1);
      line.push(decodePdfString(inner));
    }
    const t = line.join('').trim();
    if (t.length > 0) parts.push(t);
  }

  // Also pull clear ASCII runs (helps some generators)
  // Tab, LF, CR, and printable ASCII — keep as a single-line regex (Next SWC rejects multiline class)
  const asciiRe = /[\t\n\r\x20-\x7E]{4,}/g;
  while ((m = asciiRe.exec(raw))) {
    const t = m[0].trim();
    if (
      t.length >= 4 &&
      !/^[%\/]/.test(t) &&
      !/stream|endstream|obj|endobj|xref|trailer/i.test(t) &&
      /[A-Za-z]{3,}/.test(t)
    ) {
      parts.push(t);
    }
  }

  // De-dupe while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }

  return out.join('\n').trim();
}

/** Parse "Carl Edward Thompkins- New Referral.pdf" → name hints */
export function nameFromReferralFileName(name: string): {
  firstName?: string;
  lastName?: string;
  hint: string;
} {
  const base = name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
  const cleaned = base
    .replace(/\s*[-–—]?\s*(new\s+)?referral.*$/i, '')
    .replace(/\s*[-–—]?\s*(home\s+health).*$/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts[parts.length - 1],
      hint: `Patient Name: ${parts[0]} ${parts.slice(1).join(' ')}\nSource: Document upload (${name})\nReason for referral: Home health referral document received — coordinator review required`,
    };
  }
  return {
    hint: `Source: Document upload (${name})\nReason for referral: Home health referral document received — coordinator review required`,
  };
}

export async function readReferralFile(file: File): Promise<{
  text: string;
  fileName: string;
  warning?: string;
}> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdf = looksLikePdf(file, head);

  if (isPdf) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = extractTextFromPdfBytes(bytes);
    const fromName = nameFromReferralFileName(file.name);

    if (text.length < 40) {
      // Scanned or encrypted PDF — seed from filename so user can finish DOB
      text = fromName.hint;
      return {
        text,
        fileName: file.name,
        warning:
          'This PDF has little readable text (often a scan). We pre-filled what we could from the file name — add DOB and diagnosis, then save.',
      };
    }

    // Enrich with filename name if extractor missed patient name
    if (fromName.firstName && fromName.lastName && !/patient\s*name/i.test(text)) {
      text = `Patient Name: ${fromName.firstName} ${fromName.lastName}\n${text}`;
    }

    return { text, fileName: file.name };
  }

  const text = await file.text();
  if (looksLikeBinaryText(text)) {
    throw new Error(
      'That file looks like a binary document, not plain text. Export or copy the referral as text, or upload a text-based PDF.',
    );
  }
  return { text, fileName: file.name };
}
