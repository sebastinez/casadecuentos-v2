import { DEFAULT_LOCALE, type Locale } from './locales';

// Owned, first-person body copy for the "Quienes somos" page. Unlike the UI
// chrome in messages.ts, this is editorial *content* — the same status as the
// localizable record fields handled by `localizedField`: a locale may be absent
// (the table is Partial), in which case the whole block falls back to Spanish.
//
// `greeting` is the visible <h1> ("Hola!"), distinct from the chrome `about.heading`
// ("Quienes somos") used in the <title>. Each paragraph is a trusted HTML string so
// the inline <strong> emphasis survives the round-trip; it is rendered with {@html}
// (no user input — same pattern as the book/event description prose).
export interface AboutContent {
	greeting: string;
	paragraphs: string[];
}

const content: Partial<Record<Locale, AboutContent>> = {
	es: {
		greeting: 'Hola!',
		paragraphs: [
			'Me es muy grato darles la bienvenida a nuestra librería Casa de Cuentos.',
			'Mi nombre es <strong>María Eugenia</strong> y junto a mi familia planeamos este hermoso proyecto que hoy cobra vida en Suiza. Estamos ubicados en la ciudad de Rüti, cantón de Zurich. Desde aquí abrimos las puertas, deseamos que les guste y disfruten de nuestro catalogo seleccionado de cuentos en español y los invitamos a ser parte de ella.',
			'En <strong>Casa de Cuentos</strong> van a encontrar una variada selección de títulos proveniente de diferentes editoriales tanto hispanas como latinoamericanas. Encontraran libros para todas las edades desde una beboteca con una colección de libros con rimas y canciones especiales para las manitos de los bebes, pasando por los más bellos libros álbumes, libros para primeros lectores de aventuras y emociones, luego los clásicos de la literatura infantil y juvenil (narrativas universales). Libros de recetas de cocina, botánica y naturaleza. Dando también lugar a una sección de poemarios, siempre pensando en variados intereses y perspectivas.',
			'Les cuento que soy mamá de Anna y Elena, junto a Sebastián formamos nuestra familia en Buenos Aires (Argentina) y decididos a explorar nuevas aventuras, nos abrimos camino en Suiza. Soy de formación psicóloga especializada en Niñez y Familia y gracias a ella confirmo una y otra vez, la importancia de mantener un vínculo constante con aquella cultura de mi niñez y el intento por acercarla y entrelazarla con la nueva cultura que hoy abrazamos. Quiero compartirlo con otras personas que recorren el mismo viaje de vida, quienes desean mantener a Hispanoamérica viva en el corazón europeo. El momento es ahora ¡lo marca el reloj suizo, no puede fallar! Exploremos juntos los relatos hispanoamericanos más bonitos del mundo…',
			'<strong>Casa de Cuentos</strong> es una librería de puertas adentro, nos pueden visitar de forma presencial en nuestro Showroom o también vía web, y siempre serán bienvenidos a explorar nuevos libros de literatura infantil y juvenil en español. Los esperamos!'
		]
	},
	de: {
		greeting: 'Hallo!',
		paragraphs: [
			'Ich freue mich sehr, euch in unserer Buchhandlung Casa de Cuentos willkommen zu heißen.',
			'Mein Name ist <strong>María Eugenia</strong> und gemeinsam mit meiner Familie haben wir dieses wunderschöne Projekt geplant, das heute in der Schweiz Wirklichkeit wird. Wir befinden uns in der Stadt Rüti im Kanton Zürich. Von hier aus öffnen wir unsere Türen, wir wünschen uns, dass euch unser ausgewähltes Sortiment an Geschichten auf Spanisch gefällt und ihr Freude daran habt, und wir laden euch ein, ein Teil davon zu werden.',
			'Bei <strong>Casa de Cuentos</strong> findet ihr eine vielfältige Auswahl an Titeln von verschiedenen spanischen wie auch lateinamerikanischen Verlagen. Ihr findet Bücher für jedes Alter: von einer Babybibliothek mit einer Sammlung von Büchern mit Reimen und Liedern, die eigens für die kleinen Hände der Babys gedacht sind, über die schönsten Bilderbücher und Bücher für Erstleser voller Abenteuer und Gefühle bis hin zu den Klassikern der Kinder- und Jugendliteratur (universelle Erzählungen). Kochbücher sowie Bücher über Botanik und Natur. Und auch einer Abteilung mit Gedichtbänden geben wir Raum, immer mit Blick auf vielfältige Interessen und Perspektiven.',
			'Ich erzähle euch: Ich bin die Mama von Anna und Elena, gemeinsam mit Sebastián haben wir unsere Familie in Buenos Aires (Argentinien) gegründet, und entschlossen, neue Abenteuer zu erleben, haben wir uns in der Schweiz einen Weg gebahnt. Von Beruf bin ich Psychologin mit Spezialisierung auf Kindheit und Familie, und dank ihr bestätigt sich für mich immer wieder, wie wichtig es ist, eine beständige Verbindung zu jener Kultur meiner Kindheit zu bewahren und den Versuch zu wagen, sie mit der neuen Kultur, die wir heute in die Arme schließen, zu verbinden und zu verweben. Ich möchte das mit anderen Menschen teilen, die dieselbe Lebensreise gehen und Hispanoamerika im Herzen Europas lebendig halten möchten. Der Moment ist jetzt – die Schweizer Uhr gibt ihn vor, sie kann nicht irren! Lasst uns gemeinsam die schönsten hispanoamerikanischen Geschichten der Welt entdecken…',
			'<strong>Casa de Cuentos</strong> ist eine Buchhandlung hinter eigenen Türen: Ihr könnt uns persönlich in unserem Showroom oder auch online besuchen, und ihr seid jederzeit herzlich eingeladen, neue Bücher der Kinder- und Jugendliteratur auf Spanisch zu entdecken. Wir freuen uns auf euch!'
		]
	}
};

// Resolve the about-page body for a locale. Mirrors `t()`/`localizedField`:
// active locale → Spanish fallback (the block always resolves, never undefined).
export function getAboutContent(locale: Locale = DEFAULT_LOCALE): AboutContent {
	return content[locale] ?? content[DEFAULT_LOCALE]!;
}
