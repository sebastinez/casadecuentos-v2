{ lib, ... }:

{
  # Shared, site-wide settings referenced across the web/caddy/backup modules.
  options.casadecuentos = {
    domain = lib.mkOption {
      type = lib.types.str;
      example = "casadecuentos.ch";
      description = "Apex domain. The storefront serves here and at www.; PocketBase at pb.<domain>.";
    };
    acmeEmail = lib.mkOption {
      type = lib.types.str;
      description = "Email for the Let's Encrypt/ACME account (cert expiry notices).";
    };
  };
}
