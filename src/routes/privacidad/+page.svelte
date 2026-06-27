<script lang="ts">
	// Static privacy notice — hardcoded Spanish prose. Must accurately name the
	// real data processors (PRD): Stripe, Resend, Hetzner, PocketBase.
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	import { site } from '$lib/site';

	const locale = DEFAULT_LOCALE;
</script>

<svelte:head>
	<title>{t('privacy.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content="Cómo Casa de Cuentos trata tus datos personales." />
</svelte:head>

<article class="prose prose-sm max-w-none">
	<h1>{t('privacy.heading', locale)}</h1>

	<p>
		En <strong>Casa de Cuentos</strong> tratamos tus datos personales con respeto y solo en la medida
		necesaria para gestionar tus pedidos, reservas y consultas. Esta política explica qué datos recogemos,
		con qué fin y con qué proveedores los compartimos.
	</p>

	<h2>Qué datos recogemos</h2>
	<ul>
		<li>
			<strong>Pedidos:</strong> tu dirección de envío y de facturación, y los datos de tu compra. El pago
			se procesa de forma segura y nosotros nunca vemos ni almacenamos los datos completos de tu tarjeta.
		</li>
		<li>
			<strong>Reservas de actividades:</strong> nombre, apellido, correo electrónico y teléfono.
		</li>
		<li>
			<strong>Formulario de contacto:</strong> nombre, correo electrónico, asunto y mensaje.
		</li>
		<li>
			<strong>Carrito:</strong> recordamos los artículos que añades únicamente en tu navegador. No lo
			recibimos en nuestros servidores hasta que inicias el pago.
		</li>
	</ul>

	<h2>Cookies</h2>
	<p>
		En nuestras páginas no usamos cookies de seguimiento, de análisis ni de publicidad. Lo único que
		se guarda en tu navegador es tu carrito, para que no pierdas lo que has añadido hasta que
		decidas pagar. Por eso no verás un aviso de cookies pidiéndote permiso: no hay nada que rastrear
		ni que aceptar o rechazar.
	</p>
	<p>
		Cuando inicias el pago te llevamos a <strong>Stripe</strong>, nuestro proveedor de pagos, que sí
		utiliza sus propias cookies para procesar la transacción de forma segura.
	</p>

	<h2>Con quién compartimos tus datos</h2>
	<p>
		Para operar la tienda recurrimos a proveedores externos que actúan como encargados del
		tratamiento. Cada uno recibe únicamente los datos que necesita para su función:
	</p>
	<ul>
		<li>
			<strong>Stripe</strong> — procesamiento de pagos y recogida de la dirección de envío durante el
			pago (TWINT, tarjetas).
		</li>
		<li>
			<strong>Resend</strong> — envío de correos transaccionales (confirmación de pedido, aviso de envío,
			confirmación de reserva, mensajes de contacto). Servidores en la Unión Europea.
		</li>
		<li>
			<strong>Hetzner</strong> — alojamiento de nuestro servidor (centro de datos en la Unión Europea).
		</li>
		<li>
			<strong>PocketBase</strong> — la base de datos donde guardamos el catálogo, los pedidos, las reservas
			y los mensajes de contacto, en el servidor anterior.
		</li>
		<li>
			<strong>YouTube (Google) y OpenStreetMap</strong> — algunas miniaturas de vídeo y los mapas se cargan
			desde sus servidores, que pueden registrar tu dirección IP. No usamos reproductores ni rastreadores
			incrustados.
		</li>
	</ul>

	<h2>Conservación de los datos</h2>
	<p>
		Conservamos los datos de los pedidos durante el tiempo necesario para cumplir nuestras
		obligaciones legales y de garantía. Los mensajes de contacto y las reservas se conservan
		mientras sean útiles para atenderte.
	</p>

	<h2>Tus derechos</h2>
	<p>
		Puedes solicitar el acceso, la rectificación o la supresión de tus datos personales escribiendo
		a <a href="mailto:{site.email}">{site.email}</a>.
	</p>
</article>
