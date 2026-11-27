/**
 * Pure helpers for merchant brief parsing and production constraints.
 * These rules are intentionally conservative and require human confirmation.
 */
export function splitMerchantRequirements(source, limit = 16) {
  const lines = String(source || '')
    .split(/\r?\n|[。；;]+/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.、）)])\s*/, '').trim())
    .filter(line => line.length >= 3);
  return [...new Set(lines)].slice(0, Math.max(1, Number(limit) || 16));
}

export function isRestrictionRequirement(text) {
  return /不要|禁止|不得|不能|严禁|避免|不可|勿用|不允许/.test(String(text || ''));
}

/**
 * Merge merchant requirements into a shot caption without repeating text that
 * is already present. Ignore whitespace and common punctuation for matching,
 * but preserve the original wording in the final caption.
 */
export function mergeCaptionRequirements(baseCaption, requirements = []) {
  const base = String(baseCaption || '').trim();
  const normalize = value => String(value || '')
    .replace(/[\s，。！？、；：,.!?;:（）()【】《》“”"'‘’·…—_-]+/g, '')
    .toLocaleLowerCase();
  const normalizedBase = normalize(base);
  const additions = [];
  const seen = new Set();
  for (const item of requirements) {
    const text = String(item || '').trim();
    const key = normalize(text);
    if (!key || seen.has(key) || normalizedBase.includes(key)) continue;
    seen.add(key);
    additions.push(text);
  }
  return [base, ...additions].filter(Boolean).join(' · ');
}
