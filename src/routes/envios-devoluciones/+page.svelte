<script lang="ts">
	// Static shipping & returns — hardcoded Spanish prose. Must state BOTH halves
	// (PRD): warranty honored for defective/wrong items (Swiss Code of
	// Obligations) AND no change-of-mind returns (no statutory withdrawal right in
	// Switzerland).
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	import { site } from '$lib/site';

	const locale = DEFAULT_LOCALE;
</script>

<svelte:head>
	<title>{t('shipping.heading', locale)} — {t('site.name', locale)}</title>
	<meta
		name="description"
		content="Cómo enviamos tus pedidos y nuestra política de devoluciones."
	/>
</svelte:head>

<article class="prose prose-sm max-w-none">
	<h1>{t('shipping.heading', locale)}</h1>

	<h2>Envíos</h2>
	<p>
		Enviamos a toda Suiza a través de <strong>Correos Suizos (Swiss Post)</strong>. Aplicamos una
		<strong>tarifa de envío plana</strong> que se muestra durante el pago, independientemente del número
		de libros de tu pedido.
	</p>
	<p>
		Preparamos los pedidos en los días siguientes a la confirmación del pago. Cuando tu pedido sale,
		te enviamos un correo con el <strong>número de seguimiento</strong> para que puedas seguir tu paquete.
	</p>

	<h2>Garantía: productos defectuosos o incorrectos</h2>
	<p>
		Respondemos por los defectos de los libros conforme al <strong
			>Código suizo de las obligaciones</strong
		>. Si recibes un libro
		<strong>defectuoso, dañado en el transporte o distinto del que pediste</strong>, contáctanos y
		te lo
		<strong>reemplazaremos</strong> (o, si no es posible, te reembolsaremos), sin coste para ti.
	</p>
	<p>
		Para reclamar, escríbenos a <a href="mailto:{site.email}">{site.email}</a> describiendo el problema,
		a ser posible con una foto, lo antes posible tras recibir el pedido.
	</p>

	<h2>Devoluciones por cambio de opinión</h2>
	<p>
		En Suiza <strong>no existe un derecho legal de desistimiento</strong> para las compras en línea.
		Por ello <strong>no aceptamos devoluciones por cambio de opinión</strong>: te pedimos que
		revises tu selección antes de confirmar el pago. Esta política no afecta a tus derechos de
		garantía descritos arriba para productos defectuosos o incorrectos.
	</p>
</article>
