{
  lib,
  stdenvNoCC,
  fetchzip,
}:

# PocketBase pinned to EXACTLY 0.39.1 — the version the migrations and the Goja
# `pb_hooks` shipped-email hook were validated against. We fetch the official
# linux_amd64 release binary rather than taking whatever nixpkgs ships, so a
# nixpkgs bump can never silently skew the runtime under the schema/hook.
stdenvNoCC.mkDerivation rec {
  pname = "pocketbase";
  version = "0.39.1";

  src = fetchzip {
    url = "https://github.com/pocketbase/pocketbase/releases/download/v${version}/pocketbase_${version}_linux_amd64.zip";
    stripRoot = false;
    # Prefetched from the official v0.39.1 linux_amd64 release.
    hash = "sha256-eVI16h8wGJckzkHRzoij7GQXOM/rDjV7wBoxjBBQ7fE=";
  };

  dontConfigure = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall
    install -Dm755 pocketbase $out/bin/pocketbase
    runHook postInstall
  '';

  meta = {
    description = "PocketBase ${version} (pinned official linux_amd64 release binary)";
    homepage = "https://pocketbase.io";
    license = lib.licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "pocketbase";
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
}
