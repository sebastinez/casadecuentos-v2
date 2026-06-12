<script lang="ts">
	// Static "About" page — hardcoded Spanish prose per the PRD (no admin surface
	// for content pages in v1). Only the title/chrome flows through i18n; the v2
	// German version is a separate page component, not message keys.
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	import { site } from '$lib/site';

	const locale = DEFAULT_LOCALE;
</script>

<svelte:head>
	<title>{t('about.heading', locale)} — {t('site.name', locale)}</title>
	<meta
		name="description"
		content="Casa de Cuentos es una librería en línea de libros infantiles y juveniles para la comunidad hispanohablante en Suiza."
	/>
</svelte:head>

<article class="prose prose-sm max-w-none">
	<h1>{t('about.heading', locale)}</h1>

	<p>
		<strong>Casa de Cuentos</strong> es una librería en línea dedicada a los libros infantiles y juveniles
		en español, pensada para las familias hispanohablantes que viven en Suiza.
	</p>

	<p>
		Nacimos del deseo de que niñas y niños sigan leyendo en su lengua materna, lejos de su país de
		origen. Seleccionamos a mano cada título —desde los primeros libros de cartón hasta las novelas
		juveniles— buscando historias que emocionen, acompañen y hagan crecer.
	</p>

	<p>
		Somos una tienda exclusivamente en línea: enviamos a toda Suiza con seguimiento. Nuestra
		dirección, <strong>{site.address}</strong>, es un punto de contacto y referencia, pero
		<strong>no es una tienda física con venta al público</strong>.
	</p>

	<p>
		Además de vender libros, organizamos eventos comunitarios gratuitos —cuentacuentos,
		presentaciones y encuentros— para reunir a la comunidad en torno a la lectura. Puedes verlos en
		la sección <a href="/eventos">Eventos</a> y reservar tu plaza.
	</p>

	<p>
		¿Quieres saber más o buscas un libro en concreto? Escríbenos desde la página de
		<a href="/contacto">Contacto</a>.
	</p>
</article>
