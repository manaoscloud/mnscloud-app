const version = (await Deno.readTextFile("VERSION")).trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid VERSION value: ${version || "empty"}`);
}

const content = `export const APP_BUILD_INFO = {
  product: 'mnscloud-app',
  version: '${version}',
  channel: 'stable',
} as const;
`;

await Deno.writeTextFile("src/app/app-build-info.ts", content);
