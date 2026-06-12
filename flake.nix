{
  description = "Casa de Cuentos on Hetzner VPS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      sops-nix,
    }:
    let
      system = "x86_64-linux"; # Hetzner CX22 (Intel) and CPX21 (AMD) are both x86_64.
      pkgs = nixpkgs.legacyPackages.${system};

      # The SvelteKit source is this repo (the flake root). Filter out
      # generated/runtime dirs so they never enter the Nix store and never
      # invalidate the build hash (node_modules is rebuilt from the lockfile;
      # the `nix` dir is excluded so config edits don't bust the app build).
      appSrc =
        let
          root = ./.;
        in
        pkgs.lib.cleanSourceWith {
          src = pkgs.lib.cleanSource root;
          filter =
            path: _type:
            let
              rel = pkgs.lib.removePrefix (toString root + "/") (toString path);
            in
            !(builtins.elem rel [
              "node_modules"
              "build"
              ".svelte-kit"
              "pb_data"
              ".bin"
              "nix"
            ])
            && !(pkgs.lib.hasPrefix "node_modules/" rel)
            && !(pkgs.lib.hasPrefix "build/" rel)
            && !(pkgs.lib.hasPrefix ".svelte-kit/" rel);
        };
    in
    {
      # Build/inspect the packages on their own:
      #   nix build .#sveltekit   nix build .#pocketbase
      packages.${system} = {
        sveltekit = pkgs.callPackage ./nix/pkgs/sveltekit.nix { src = appSrc; };
        pocketbase = pkgs.callPackage ./nix/pkgs/pocketbase.nix { };
      };

      nixosConfigurations.casadecuentos = nixpkgs.lib.nixosSystem {
        inherit system;
        specialArgs = { inherit self appSrc; };
        modules = [
          sops-nix.nixosModules.sops
          ./nix/configuration.nix
        ];
      };
    };
}
