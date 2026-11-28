/** Return whether an async proxy task still owns the cache entry for its source. */
export function isCurrentProxyGeneration(cache, sourceUrl, generationEntry) {
  return cache.get(sourceUrl) === generationEntry;
}
