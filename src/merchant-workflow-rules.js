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
