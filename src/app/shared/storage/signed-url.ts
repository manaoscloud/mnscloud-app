export function isSignedStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has('X-Amz-Signature') ||
      parsed.searchParams.has('Signature') ||
      parsed.searchParams.has('AWSAccessKeyId')
    );
  } catch {
    return false;
  }
}
