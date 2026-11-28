/**
 * Select only visible video clips for export frame seeking.
 * Hidden-track media must not be decoded or allowed to fail an otherwise valid export.
 */
export function getExportableVideoClips(composition) {
  if (!Array.isArray(composition?.clips)) return [];
  const tracks = Array.isArray(composition.tracks) ? composition.tracks : [];
  const trackById = new Map(tracks.map(track => [track.id, track]));
  return composition.clips.filter(clip => {
    if (clip?.type !== 'video' || !clip.element) return false;
    const track = trackById.get(clip.trackId);
    return !track || track.visible !== false;
  });
}
