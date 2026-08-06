#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

promote_candidate() {
  local candidate_dir="$1"
  local verify_only="${2:-0}"
  local metadata_file="${candidate_dir}/release-candidate.json"
  local payload_dir="${candidate_dir}/payload"

  [[ -f "$metadata_file" ]] || {
    printf '[mnscloud-app] ERROR: release candidate metadata not found\n' >&2
    exit 1
  }
  [[ -d "$payload_dir" ]] || {
    printf '[mnscloud-app] ERROR: release candidate payload not found\n' >&2
    exit 1
  }
  if [[ "$verify_only" != "1" ]]; then
    local unexpected_dirty
    unexpected_dirty="$(git status --short | awk '{print $2}' | grep -Ev '^(VERSION|package.json|package-lock.json|src/app/app-build-info[.]ts|releases/manifest[.]json|releases/mnscloud-app-browser-v[0-9A-Za-z.+_-]+[.]tar[.]gz([.]sha256)?)$' || true)"
    [[ -z "$unexpected_dirty" ]] || {
      printf '[mnscloud-app] ERROR: working tree has unexpected changes before promotion:\n%s\n' "$unexpected_dirty" >&2
      exit 1
    }
  fi

  local source_sha version artifact_name expected_sha actual_sha
  readarray -t candidate < <(deno eval '
const data = JSON.parse(await Deno.readTextFile(Deno.args[0]));
for (const key of ["sourceSha", "version", "artifactName", "sha256"]) {
  if (typeof data[key] !== "string" || !data[key]) throw new Error(`missing ${key}`);
  console.log(data[key]);
}
' "$metadata_file")
  source_sha="${candidate[0]}"
  version="${candidate[1]}"
  artifact_name="${candidate[2]}"
  expected_sha="${candidate[3]}"

  [[ "$source_sha" == "$(git rev-parse HEAD)" ]] || {
    printf '[mnscloud-app] ERROR: candidate source SHA does not match checked out source\n' >&2
    exit 1
  }
  [[ "$version" =~ ^[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?$ ]] || {
    printf '[mnscloud-app] ERROR: invalid candidate version\n' >&2
    exit 1
  }
  [[ -f "${payload_dir}/releases/${artifact_name}" ]] || {
    printf '[mnscloud-app] ERROR: candidate browser artifact is missing\n' >&2
    exit 1
  }

  cp "${payload_dir}/VERSION" VERSION
  cp "${payload_dir}/package.json" package.json
  cp "${payload_dir}/package-lock.json" package-lock.json
  install -D -m 0644 "${payload_dir}/src/app/app-build-info.ts" src/app/app-build-info.ts
  cp "${payload_dir}/releases/manifest.json" releases/manifest.json
  cp "${payload_dir}/releases/${artifact_name}" "releases/${artifact_name}"
  cp "${payload_dir}/releases/${artifact_name}.sha256" "releases/${artifact_name}.sha256"

  actual_sha="$(sha256sum "releases/${artifact_name}" | awk '{print $1}')"
  [[ "$actual_sha" == "$expected_sha" ]] || {
    printf '[mnscloud-app] ERROR: candidate artifact checksum mismatch\n' >&2
    exit 1
  }
  (
    cd releases
    sha256sum -c "${artifact_name}.sha256"
  )

  local extract_dir missing asset
  extract_dir="$(mktemp -d)"
  trap 'rm -rf "$extract_dir"' RETURN
  tar -xzf "releases/${artifact_name}" -C "$extract_dir"
  [[ -f "${extract_dir}/index.html" ]] || {
    printf '[mnscloud-app] ERROR: candidate artifact is missing index.html\n' >&2
    exit 1
  }
  missing=0
  while IFS= read -r asset; do
    [[ -n "$asset" ]] || continue
    if [[ ! -f "${extract_dir}/${asset}" ]]; then
      printf '[mnscloud-app] ERROR: candidate references missing asset: %s\n' "$asset" >&2
      missing=1
    fi
  done < <(grep -Eo '(main|polyfills|styles|chunk)-[A-Za-z0-9_-]+[.](js|css)' "${extract_dir}/index.html" | sort -u)
  [[ "$missing" == "0" ]] || exit 1

  deno eval '
const [manifestPath, version, artifactName, sha256] = Deno.args;
const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
const stable = manifest.channels?.stable;
if (stable?.version !== version || stable?.ref !== `v${version}` ||
  stable?.artifact?.name !== artifactName || stable?.artifact?.sha256 !== sha256) {
  throw new Error("release manifest does not match candidate metadata");
}
' releases/manifest.json "$version" "$artifact_name" "$expected_sha"

  if [[ "$verify_only" == "1" ]]; then
    printf '[mnscloud-app] validated promotion payload for v%s\n' "$version"
    return 0
  fi

  local release_branch="release/mnscloud-app-v${version}"
  local release_tag="v${version}"
  if git ls-remote --exit-code --tags origin "refs/tags/${release_tag}" >/dev/null 2>&1; then
    local existing_manifest existing_source existing_sha
    existing_manifest="$(mktemp)"
    git fetch --quiet origin "refs/tags/${release_tag}:refs/tags/${release_tag}"
    git show "${release_tag}:releases/manifest.json" > "$existing_manifest"
    readarray -t existing_release < <(deno eval '
const stable = JSON.parse(await Deno.readTextFile(Deno.args[0])).channels?.stable;
console.log(stable?.sourceSha ?? "");
console.log(stable?.artifact?.sha256 ?? "");
' "$existing_manifest")
    rm -f "$existing_manifest"
    existing_source="${existing_release[0]:-}"
    existing_sha="${existing_release[1]:-}"
    [[ "$existing_source" == "$source_sha" && "$existing_sha" == "$expected_sha" ]] || {
      printf '[mnscloud-app] ERROR: existing release tag %s does not match this candidate\n' "$release_tag" >&2
      exit 1
    }
  else
    git switch -c "$release_branch"
    git add -f VERSION package.json package-lock.json src/app/app-build-info.ts releases/manifest.json \
      "releases/${artifact_name}" "releases/${artifact_name}.sha256"
    git commit -m "Release mnscloud-app v${version}"
    git tag -a "$release_tag" -m "Release mnscloud-app v${version}"
    git push origin "$release_branch"
    git push origin "$release_tag"
  fi
  if ! gh release view "$release_tag" --repo manaoscloud/mnscloud-app >/dev/null 2>&1; then
    gh release create "$release_tag" --repo manaoscloud/mnscloud-app --title "mnscloud-app v${version}" \
      --generate-notes
  fi
  gh release upload "$release_tag" --repo manaoscloud/mnscloud-app --clobber \
    "releases/${artifact_name}" "releases/${artifact_name}.sha256"
  printf '[mnscloud-app] promoted validated artifact for v%s\n' "$version"
}

if [[ "${1:-}" == "--promote-artifact" ]]; then
  [[ -n "${2:-}" ]] || {
    printf '[mnscloud-app] ERROR: --promote-artifact requires a directory\n' >&2
    exit 2
  }
  cd "$REPO_ROOT"
  promote_candidate "$2"
  exit 0
fi

if [[ "${1:-}" == "--verify-promotion-artifact" ]]; then
  [[ -n "${2:-}" ]] || {
    printf '[mnscloud-app] ERROR: --verify-promotion-artifact requires a directory\n' >&2
    exit 2
  }
  cd "$REPO_ROOT"
  promote_candidate "$2" 1
  exit 0
fi

find_runtime_kit() {
  local candidate
  for candidate in \
    "${MNSCLOUD_RUNTIME_KIT_DIR:-}" \
    "${REPO_ROOT}/../mnscloud-runtime-kit" \
    "/opt/mnscloud/runtime-kit" \
    "/opt/mnscloud/repos/mnscloud-runtime-kit"; do
    [[ -n "$candidate" && -r "${candidate}/lib/release.sh" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done
  return 1
}

cd "$REPO_ROOT"
RUNTIME_KIT_DIR="$(find_runtime_kit)" || {
  printf '[mnscloud-app] ERROR: mnscloud-runtime-kit lib/release.sh not found\n' >&2
  exit 1
}

# shellcheck source=/opt/mnscloud/runtime-kit/lib/release.sh
source "${RUNTIME_KIT_DIR}/lib/release.sh"

mrtk_release_prepare \
  --product mnscloud-app \
  --repository manaoscloud/mnscloud-app \
  --minimum-version 0.1.0 \
  --sync-package-json \
  --add-path src/app/app-build-info.ts \
  --validate 'bash -n scripts/*.sh' \
  --validate 'deno run --allow-read --allow-write scripts/write-app-build-info.ts' \
  --validate 'npm run build' \
  --validate 'bash scripts/package-browser-artifact.sh' \
  --asset-glob 'releases/mnscloud-app-browser-v*.tar.gz' \
  --asset-glob 'releases/mnscloud-app-browser-v*.tar.gz.sha256' \
  "$@"
