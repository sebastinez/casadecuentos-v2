<script lang="ts">
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	// `?enhanced` emits a responsive, multi-format picture (AVIF/webp + the listed
	// widths) with intrinsic dimensions baked in. The source is ~4000×6000, so we
	// pin widths to the actual render slot (≤480px CSS, ×2 for retina) instead of
	// letting the plugin ship multi-megabyte halvings of the original.
	import euge from '$lib/assets/euge.webp?enhanced&w=480;960;1440';

	const locale = DEFAULT_LOCALE;
</script>

<svelte:head>
	<title>{t('about.heading', locale)} — {t('site.name', locale)}</title>
	<meta
		name="description"
		content="Casa de Cuentos es una librería en línea de libros infantiles y juveniles para la comunidad hispanohablante en Suiza."
	/>
</svelte:head>

<div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
	<!-- <enhanced:img> emits a <picture>; the sticky/sizing must live on a real block
	     wrapper (the grid child), not on the inner <img>, for md:sticky to work. -->
	<div class="md:sticky md:top-8">
		<enhanced:img
			src={euge}
			alt="María Eugenia, fundadora de Casa de Cuentos"
			sizes="(min-width: 768px) 480px, 100vw"
			class="block w-full rounded-lg"
		/>
	</div>

	<article class="prose prose-sm max-w-none">
		<h1>Hola!</h1>

		<p>Me es muy grato darles la bienvenida a nuestra librería Casa de Cuentos.</p>

		<p>
			Mi nombre es <strong>María Eugenia</strong> y junto a mi familia planeamos este hermoso proyecto
			que hoy cobra vida en Suiza. Estamos ubicados en la ciudad de Rüti, cantón de Zurich. Desde aquí
			abrimos las puertas, deseamos que les guste y disfruten de nuestro catalogo seleccionado de cuentos
			en español y los invitamos a ser parte de ella.
		</p>

		<p>
			En <strong>Casa de Cuentos</strong> van a encontrar una variada selección de títulos proveniente
			de diferentes editoriales tanto hispanas como latinoamericanas. Encontraran libros para todas las
			edades desde una beboteca con una colección de libros con rimas y canciones especiales para las
			manitos de los bebes, pasando por los más bellos libros álbumes, libros para primeros lectores de
			aventuras y emociones, luego los clásicos de la literatura infantil y juvenil (narrativas universales).
			Libros de recetas de cocina, botánica y naturaleza. Dando también lugar a una sección de poemarios,
			siempre pensando en variados intereses y perspectivas.
		</p>

		<p>
			Les cuento que soy mamá de Anna y Elena, junto a Sebastián formamos nuestra familia en Buenos
			Aires (Argentina) y decididos a explorar nuevas aventuras, nos abrimos camino en Suiza. Soy de
			formación psicóloga especializada en Niñez y Familia y gracias a ella confirmo una y otra vez,
			la importancia de mantener un vínculo constante con aquella cultura de mi niñez y el intento
			por acercarla y entrelazarla con la nueva cultura que hoy abrazamos. Quiero compartirlo con
			otras personas que recorren el mismo viaje de vida, quienes desean mantener a Hispanoamérica
			viva en el corazón europeo. El momento es ahora ¡lo marca el reloj suizo, no puede fallar!
			Exploremos juntos los relatos hispanoamericanos más bonitos del mundo…
		</p>

		<p>
			<strong>Casa de Cuentos</strong> es una librería de puertas adentro, nos pueden visitar de forma
			presencial en nuestro Showroom o también vía web, y siempre serán bienvenidos a explorar nuevos
			libros de literatura infantil y juvenil en español. Los esperamos!
		</p>
	</article>
</div>
