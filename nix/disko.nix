{
  # Single-disk GPT layout for a Hetzner Cloud VM, consumed by nixos-anywhere.
  # GPT with a 1 MiB BIOS-boot partition + an ESP makes the image boot on both
  # the BIOS and UEFI Hetzner Cloud variants. Hetzner Cloud's primary disk is
  # /dev/sda. CX22 ships ~40 GB, CPX21 ~80 GB — root simply fills the rest.
  disko.devices.disk.main = {
    type = "disk";
    device = "/dev/sda";
    content = {
      type = "gpt";
      partitions = {
        boot = {
          size = "1M";
          type = "EF02"; # BIOS boot partition (GRUB on BIOS machines).
        };
        ESP = {
          size = "512M";
          type = "EF00";
          content = {
            type = "filesystem";
            format = "vfat";
            mountpoint = "/boot";
            mountOptions = [ "umask=0077" ];
          };
        };
        root = {
          size = "100%";
          content = {
            type = "filesystem";
            format = "ext4";
            mountpoint = "/";
          };
        };
      };
    };
  };
}
