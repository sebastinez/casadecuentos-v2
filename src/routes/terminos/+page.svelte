<script lang="ts">
	// Static terms & conditions — hardcoded Spanish prose.
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	import { site } from '$lib/site';

	const locale = DEFAULT_LOCALE;
</script>

<svelte:head>
	<title>{t('terms.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content="Condiciones de uso y de compra en Casa de Cuentos." />
</svelte:head>

<article class="prose prose-sm max-w-none">
	<h1>{t('terms.heading', locale)}</h1>

	<p>
		Estas condiciones regulan el uso de la tienda en línea <strong>Casa de Cuentos</strong> y la compra
		de productos a través de ella. Al realizar un pedido aceptas estas condiciones.
	</p>

	<h2>Productos y precios</h2>
	<p>
		Vendemos libros infantiles y juveniles. Los precios se muestran en francos suizos (CHF) e
		incluyen los impuestos aplicables. No estamos sujetos al IVA suizo, por lo que los precios no
		desglosan ningún impuesto. Nos reservamos el derecho de modificar los precios y el catálogo en
		cualquier momento; el precio aplicable es el vigente en el momento de tu pedido.
	</p>

	<h2>Pedidos y pago</h2>
	<p>
		El pago se realiza a través de una página de pago segura (TWINT o tarjeta). El pedido se
		confirma una vez recibido el pago; recibirás un correo de confirmación. El precio que se cobra
		es siempre el precio del catálogo verificado en nuestro servidor.
	</p>

	<h2>Disponibilidad</h2>
	<p>
		Trabajamos con existencias limitadas. En el caso excepcional de que un libro figure como
		disponible pero ya no lo esté tras tu compra, te lo comunicaremos y te reembolsaremos el importe
		correspondiente.
	</p>

	<h2>Envíos, garantía y devoluciones</h2>
	<p>
		Las condiciones de envío y la política de garantía y devoluciones se detallan en la página de
		<a href="/envios-devoluciones">Envíos y devoluciones</a>.
	</p>

	<h2>Contacto</h2>
	<p>
		Para cualquier consulta sobre estas condiciones, escríbenos a
		<a href="mailto:{site.email}">{site.email}</a>.
	</p>
</article>
