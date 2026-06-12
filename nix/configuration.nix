{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.casadecuentos;
in
{
  imports = [
    ./hardware.nix
    ./disko.nix
    ./modules/options.nix
    ./modules/secrets.nix
    ./modules/web.nix
    ./modules/caddy.nix
    ./modules/backups.nix
  ];

  # ── Site-wide settings the owner edits in ONE place ──────────────────────────
  casadecuentos = {
    domain = "casadecuentos.ch"; # ← change to the real apex domain
    acmeEmail = "me@sebastinez.dev"; # ← Let's Encrypt account / expiry notices
  };

  # ── Boot / disk ──────────────────────────────────────────────────────────────
  # disko declares the filesystems. Installing GRUB to the disk (/dev/sda) plus
  # the EF02 BIOS-boot partition covers BIOS-booting Hetzner VMs; efiSupport +
  # the ESP also covers the UEFI variant — safe whichever mode the box uses.
  boot.loader.grub = {
    enable = true;
    efiSupport = true;
    efiInstallAsRemovable = true;
    device = "/dev/sda";
  };

  # ── Host basics ────────────────────────────────────────────────────────────
  networking.hostName = "casadecuentos";
  time.timeZone = "Europe/Zurich";
  i18n.defaultLocale = "en_US.UTF-8";

  # The BFF reads PocketBase at https://pb.<domain>. Pinning that name to
  # loopback keeps the SvelteKit→PocketBase traffic on the box (no public
  # hairpin) while still presenting Caddy's valid TLS cert. Browsers and the
  # WhatsApp/Instagram OG crawlers resolve the same name via public DNS.
  networking.hosts."127.0.0.1" = [ "pb.${cfg.domain}" ];

  # ── SSH (key-only) ───────────────────────────────────────────────────────────
  services.openssh = {
    enable = true;
    ports = [ 22 ];
    settings = {
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
      PermitRootLogin = "prohibit-password";
    };
  };
  users.users.root.openssh.authorizedKeys.keys = [
    # ← paste the SSH public key you provision the Hetzner box with
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIICWzKD8yOLRKBT2rtg/S5vgYMRiuqqVaZX6QU09BgUW me@sebastinez.dev"
  ];

  # ── Firewall: only SSH + HTTP/HTTPS. PocketBase (8090) and SvelteKit (3000)
  #    listen on loopback only and are never exposed directly. ──────────────────
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      22
      80
      443
    ];
  };

  # ── Nix / flakes ─────────────────────────────────────────────────────────────
  nix.settings.experimental-features = [
    "nix-command"
    "flakes"
  ];
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };

  environment.systemPackages = with pkgs; [
    git
    sops
    age
    ssh-to-age
    sqlite # for inspecting / restoring the PocketBase DB during ops
  ];

  # Set on first install to the NixOS release you deployed; never change after.
  system.stateVersion = "25.05";
}
