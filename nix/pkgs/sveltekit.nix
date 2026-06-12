{
  lib,
  stdenv,
  src,
  nodejs_22,
  pnpm_10,
}:

# Builds the SvelteKit BFF with adapter-node into a self-contained `build/`.
# adapter-node bundles the server's runtime dependencies, so the output runs as
# `node build` with no node_modules at runtime — we ship only build/ + package.json.
#
# pnpm-in-Nix uses the fixed-output `pnpmDeps` store: the first build will fail
# with a hash mismatch and print the correct `pnpmDeps.hash` — paste it below
# (TOFU). The deps hash is content-addressed, so it is the same on any builder.
stdenv.mkDerivation (finalAttrs: {
  pname = "casadecuentos-sveltekit";
  version = "0.0.1";

  inherit src;

  # NB: attr names are for nixos-25.05. On 25.11+ these were renamed to the
  # top-level `pnpmConfigHook` / `fetchPnpmDeps`.
  nativeBuildInputs = [
    nodejs_22
    pnpm_10.configHook
  ];

  pnpmDeps = pnpm_10.fetchDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 2;
    hash = lib.fakeHash;
  };

  # The repo is also the PocketBase migrations/hooks source; only build the app.
  buildPhase = ''
    runHook preBuild
    pnpm run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/casadecuentos
    cp -r build $out/lib/casadecuentos/build
    cp package.json $out/lib/casadecuentos/package.json
    runHook postInstall
  '';

  meta = {
    description = "Casa de Cuentos storefront";
    platforms = [ "x86_64-linux" ];
  };
})
