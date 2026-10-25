export async function resolveMediaPlayback(
  uuid: string,
  source: { url: string; downloadUrl?: string },
  getBlob: (endpoint: string) => Promise<Blob>,
): Promise<{ url: string; downloadUrl: string; release: () => void }> {
  const endpoint = `voip/pabx/media-files/${encodeURIComponent(uuid)}/content`;
  if (!source.url.startsWith('/api/v1/voip/pabx/media-files/')) {
    return {
      url: source.url,
      downloadUrl: source.downloadUrl || source.url,
      release: () => {},
    };
  }
  if (source.url !== `/api/v1/${endpoint}`) {
    throw new Error('Media playback URL does not match the selected file.');
  }
  // ApiService supplies authentication and the selected tenant; an audio element cannot.
  const url = URL.createObjectURL(await getBlob(endpoint));
  let released = false;
  return {
    url,
    downloadUrl: url,
    release: () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(url);
    },
  };
}
