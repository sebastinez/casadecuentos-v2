{ modulesPath, ... }:

{
  # Minimal hardware profile for a Hetzner Cloud VM (virtio). This makes the
  # flake self-contained so nixos-anywhere needs no on-target nixos-generate-config.
  imports = [ (modulesPath + "/profiles/qemu-guest.nix") ];

  boot.initrd.availableKernelModules = [
    "virtio_pci"
    "virtio_scsi"
    "ahci"
    "sd_mod"
  ];
  boot.initrd.kernelModules = [ ];
  boot.kernelModules = [ ];
  boot.extraModulePackages = [ ];

  # Hetzner Cloud provides IPv4 + IPv6 via DHCP/RA.
  networking.useDHCP = true;

  # QEMU guest agent (graceful shutdown/console from the Hetzner panel).
  services.qemuGuest.enable = true;

  nixpkgs.hostPlatform = "x86_64-linux";
}
