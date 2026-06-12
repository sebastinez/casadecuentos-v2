{ config, ... }:

let
  cfg = config.casadecuentos;
in
{
  # Caddy terminates TLS (automatic HTTPS via Let's Encrypt) and reverse-proxies
  # to the two loopback services. Three vhosts:
  #   <domain>      → SvelteKit (storefront + /api/checkout, /api/webhooks/stripe, /api/catalogo)
  #   www.<domain>  → 301 redirect to the apex
  #   pb.<domain>   → PocketBase (public /api/files for covers/OG + the admin UI)
  services.caddy = {
    enable = true;
    email = cfg.acmeEmail;

    virtualHosts."${cfg.domain}".extraConfig = ''
      reverse_proxy 127.0.0.1:3000
    '';

    virtualHosts."www.${cfg.domain}".extraConfig = ''
      redir https://${cfg.domain}{uri} permanent
    '';

    # PocketBase sits behind this proxy. Caddy sets X-Forwarded-* so PocketBase
    # can see the real client IP once its "trusted proxy" setting is configured
    # in the admin (see DEPLOY.md). The collection API rules are the security
    # boundary here — orders/rsvps/contact_messages must stay superuser-only.
    virtualHosts."pb.${cfg.domain}".extraConfig = ''
      reverse_proxy 127.0.0.1:8090
    '';
  };
}
