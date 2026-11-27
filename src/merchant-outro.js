const clean = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Build an end card only from merchant-supplied facts. */
export function buildMerchantOutroText(profile = {}) {
  const shop = clean(profile.shop);
  if (!shop) return null;
  const product = clean(profile.product);
  const address = clean(profile.address);
  const lines = [shop];
  if (product) lines.push(`主打：${product}`);
  if (address) lines.push(`地址：${address}`);
  lines.push('欢迎咨询了解');
  return lines.join('\n');
}
