import { DEFAULT_LOCALE, type Locale } from './locales';
import { site } from '$lib/site';

// Owned body copy for the static legal pages (privacy, terms, shipping). Same
// status as `about-content` and the localizable record fields: editorial prose,
// not UI chrome — a locale may be absent (the table is Partial), in which case
// the whole page falls back to Spanish.
//
// The <h1> and <title> still come from the `*.heading` keys in messages.ts; this
// module owns everything below the heading. Each section's `body` is a trusted
// HTML string (no user input) rendered with {@html}, so inline <strong>, <ul>,
// <a> and <br> survive the round-trip — the same pattern as the book/event prose.
//
// `email` links reuse `site.email` so the address stays single-sourced. The one
// internal link (terms → shipping) is baked per-locale because the URL locale
// prefix is itself part of that locale's content (`/es/…` vs `/de/…`).
export interface ProseSection {
	// Rendered as <h2>. Omitted for a lead paragraph that sits directly under the <h1>.
	heading?: string;
	// Trusted HTML: <p>, <ul>, <a>, <strong>, <br>. Rendered with {@html}.
	body: string;
}

export interface LegalPage {
	metaDescription: string;
	sections: ProseSection[];
}

type LegalPageKey = 'privacy' | 'terms' | 'shipping';

const email = `<a href="mailto:${site.email}">${site.email}</a>`;

const content: Record<LegalPageKey, Partial<Record<Locale, LegalPage>>> = {
	privacy: {
		es: {
			metaDescription: 'Cómo Casa de Cuentos trata tus datos personales.',
			sections: [
				{
					body: `<p>En <strong>Casa de Cuentos</strong> tratamos tus datos personales con respeto y solo en la medida necesaria para gestionar tus pedidos, reservas y consultas. Esta política explica qué datos recogemos, con qué fin y con qué proveedores los compartimos.</p>`
				},
				{
					heading: 'Qué datos recogemos',
					body: `<ul>
						<li><strong>Pedidos:</strong> tu dirección de envío y de facturación, y los datos de tu compra. El pago se procesa de forma segura y nosotros nunca vemos ni almacenamos los datos completos de tu tarjeta.</li>
						<li><strong>Reservas de actividades:</strong> nombre, apellido, correo electrónico y teléfono.</li>
						<li><strong>Formulario de contacto:</strong> nombre, correo electrónico, asunto y mensaje.</li>
						<li><strong>Carrito:</strong> recordamos los artículos que añades únicamente en tu navegador. No lo recibimos en nuestros servidores hasta que inicias el pago.</li>
					</ul>`
				},
				{
					heading: 'Cookies',
					body: `<p>En nuestras páginas no usamos cookies de seguimiento, de análisis ni de publicidad. Lo único que se guarda en tu navegador es tu carrito, para que no pierdas lo que has añadido hasta que decidas pagar. Por eso no verás un aviso de cookies pidiéndote permiso: no hay nada que rastrear ni que aceptar o rechazar.</p>
						<p>Cuando inicias el pago te llevamos a <strong>Stripe</strong>, nuestro proveedor de pagos, que sí utiliza sus propias cookies para procesar la transacción de forma segura.</p>`
				},
				{
					heading: 'Con quién compartimos tus datos',
					body: `<p>Para operar la tienda recurrimos a proveedores externos que actúan como encargados del tratamiento. Cada uno recibe únicamente los datos que necesita para su función:</p>
						<ul>
							<li><strong>Stripe</strong> — procesamiento de pagos y recogida de la dirección de envío durante el pago (TWINT, tarjetas).</li>
							<li><strong>Resend</strong> — envío de correos transaccionales (confirmación de pedido, aviso de envío, confirmación de reserva, mensajes de contacto). Servidores en la Unión Europea.</li>
							<li><strong>Hetzner</strong> — alojamiento de nuestro servidor (centro de datos en la Unión Europea).</li>
							<li><strong>PocketBase</strong> — la base de datos donde guardamos el catálogo, los pedidos, las reservas y los mensajes de contacto, en el servidor anterior.</li>
							<li><strong>YouTube (Google) y OpenStreetMap</strong> — algunas miniaturas de vídeo y los mapas se cargan desde sus servidores, que pueden registrar tu dirección IP. No usamos reproductores ni rastreadores incrustados.</li>
						</ul>`
				},
				{
					heading: 'Conservación de los datos',
					body: `<p>Conservamos los datos de los pedidos durante el tiempo necesario para cumplir nuestras obligaciones legales y de garantía. Los mensajes de contacto y las reservas se conservan mientras sean útiles para atenderte.</p>`
				},
				{
					heading: 'Tus derechos',
					body: `<p>Puedes solicitar el acceso, la rectificación o la supresión de tus datos personales escribiendo a ${email}.</p>`
				}
			]
		},
		de: {
			metaDescription: 'Wie Casa de Cuentos deine personenbezogenen Daten behandelt.',
			sections: [
				{
					body: `<p>Bei <strong>Casa de Cuentos</strong> behandeln wir deine personenbezogenen Daten mit Respekt und nur in dem Umfang, der nötig ist, um deine Bestellungen, Reservierungen und Anfragen zu bearbeiten. Diese Erklärung beschreibt, welche Daten wir erheben, zu welchem Zweck und mit welchen Anbietern wir sie teilen.</p>`
				},
				{
					heading: 'Welche Daten wir erheben',
					body: `<ul>
						<li><strong>Bestellungen:</strong> deine Liefer- und Rechnungsadresse sowie die Angaben zu deinem Einkauf. Die Zahlung wird sicher verarbeitet, und wir sehen oder speichern niemals die vollständigen Daten deiner Karte.</li>
						<li><strong>Reservierungen für Aktivitäten:</strong> Vorname, Nachname, E-Mail-Adresse und Telefonnummer.</li>
						<li><strong>Kontaktformular:</strong> Name, E-Mail-Adresse, Betreff und Nachricht.</li>
						<li><strong>Warenkorb:</strong> Wir merken uns die von dir hinzugefügten Artikel ausschließlich in deinem Browser. Sie erreichen unsere Server erst, wenn du die Zahlung startest.</li>
					</ul>`
				},
				{
					heading: 'Cookies',
					body: `<p>Auf unseren Seiten verwenden wir keine Tracking-, Analyse- oder Werbe-Cookies. Das Einzige, was in deinem Browser gespeichert wird, ist dein Warenkorb, damit du das Hinzugefügte nicht verlierst, bis du dich zur Zahlung entscheidest. Deshalb siehst du auch keinen Cookie-Hinweis, der dich um Erlaubnis bittet: Es gibt nichts zu verfolgen und nichts zu akzeptieren oder abzulehnen.</p>
						<p>Wenn du die Zahlung startest, leiten wir dich zu <strong>Stripe</strong>, unserem Zahlungsdienstleister, weiter, der eigene Cookies verwendet, um die Transaktion sicher abzuwickeln.</p>`
				},
				{
					heading: 'Mit wem wir deine Daten teilen',
					body: `<p>Für den Betrieb des Shops greifen wir auf externe Anbieter zurück, die als Auftragsverarbeiter tätig sind. Jeder erhält ausschließlich die Daten, die er für seine Funktion benötigt:</p>
						<ul>
							<li><strong>Stripe</strong> — Zahlungsabwicklung und Erfassung der Lieferadresse während der Zahlung (TWINT, Karten).</li>
							<li><strong>Resend</strong> — Versand von Transaktions-E-Mails (Bestellbestätigung, Versandbenachrichtigung, Reservierungsbestätigung, Kontaktnachrichten). Server in der Europäischen Union.</li>
							<li><strong>Hetzner</strong> — Hosting unseres Servers (Rechenzentrum in der Europäischen Union).</li>
							<li><strong>PocketBase</strong> — die Datenbank, in der wir den Katalog, die Bestellungen, die Reservierungen und die Kontaktnachrichten speichern, auf dem zuvor genannten Server.</li>
							<li><strong>YouTube (Google) und OpenStreetMap</strong> — einige Video-Vorschaubilder und die Karten werden von deren Servern geladen, die deine IP-Adresse aufzeichnen können. Wir verwenden keine eingebetteten Player oder Tracker.</li>
						</ul>`
				},
				{
					heading: 'Aufbewahrung der Daten',
					body: `<p>Wir bewahren die Bestelldaten so lange auf, wie es zur Erfüllung unserer gesetzlichen und gewährleistungsrechtlichen Pflichten erforderlich ist. Kontaktnachrichten und Reservierungen bewahren wir so lange auf, wie sie für deine Betreuung nützlich sind.</p>`
				},
				{
					heading: 'Deine Rechte',
					body: `<p>Du kannst die Auskunft, Berichtigung oder Löschung deiner personenbezogenen Daten beantragen, indem du an ${email} schreibst.</p>`
				}
			]
		}
	},

	terms: {
		es: {
			metaDescription: 'Condiciones de uso y de compra en Casa de Cuentos.',
			sections: [
				{
					body: `<p>Estas condiciones regulan el uso de la tienda en línea <strong>Casa de Cuentos</strong> y la compra de productos a través de ella. Al realizar un pedido aceptas estas condiciones.</p>`
				},
				{
					heading: 'Productos y precios',
					body: `<p>Vendemos libros infantiles y juveniles. Los precios se muestran en francos suizos (CHF) e incluyen los impuestos aplicables. No estamos sujetos al IVA suizo, por lo que los precios no desglosan ningún impuesto. Nos reservamos el derecho de modificar los precios y el catálogo en cualquier momento; el precio aplicable es el vigente en el momento de tu pedido.</p>`
				},
				{
					heading: 'Pedidos y pago',
					body: `<p>El pago se realiza a través de una página de pago segura. El pedido se confirma una vez recibido el pago; recibirás un correo de confirmación. El precio que se cobra es siempre el precio del catálogo verificado en nuestro servidor.</p>`
				},
				{
					heading: 'Disponibilidad',
					body: `<p>Trabajamos con stock limitado. En el caso excepcional de que un libro figure como disponible pero ya no lo esté tras tu compra, te lo comunicaremos y te reembolsaremos el importe correspondiente.</p>`
				},
				{
					heading: 'Envíos, garantía y devoluciones',
					body: `<p>Las condiciones de envío y la política de garantía y devoluciones se detallan en la página de <a href="/es/envios-devoluciones">Envíos y devoluciones</a>.</p>`
				},
				{
					heading: 'Contacto',
					body: `<p>Para cualquier consulta sobre estas condiciones, escríbenos a ${email}.</p>`
				},
				{
					heading: 'Impressum',
					body: `<p>Nombre comercial: Bücherei Casa de Cuentos von M.E. Raffo<br />
						Rechtsform: Einzelunternehmen<br />
						Número de teléfono: 076 474 3828<br />
						Correo electrónico: info@casadecuentos.ch<br />
						Dirección física: Ahornweg 22, 8630 Rüti, Switzerland<br />
						Número comercial: CHE-496.195.964</p>`
				}
			]
		},
		de: {
			metaDescription: 'Nutzungs- und Kaufbedingungen bei Casa de Cuentos.',
			sections: [
				{
					body: `<p>Diese Bedingungen regeln die Nutzung des Online-Shops <strong>Casa de Cuentos</strong> und den Kauf von Produkten über ihn. Mit einer Bestellung akzeptierst du diese Bedingungen.</p>`
				},
				{
					heading: 'Produkte und Preise',
					body: `<p>Wir verkaufen Kinder- und Jugendbücher. Die Preise werden in Schweizer Franken (CHF) angezeigt und enthalten die anwendbaren Steuern. Wir sind in der Schweiz nicht mehrwertsteuerpflichtig, weshalb die Preise keine Steuern gesondert ausweisen. Wir behalten uns das Recht vor, die Preise und den Katalog jederzeit zu ändern; es gilt der zum Zeitpunkt deiner Bestellung gültige Preis.</p>`
				},
				{
					heading: 'Bestellungen und Zahlung',
					body: `<p>Die Zahlung erfolgt über eine sichere Zahlungsseite. Die Bestellung wird bestätigt, sobald die Zahlung eingegangen ist; du erhältst eine Bestätigungs-E-Mail. Der berechnete Preis ist stets der auf unserem Server verifizierte Katalogpreis.</p>`
				},
				{
					heading: 'Verfügbarkeit',
					body: `<p>Wir arbeiten mit begrenztem Lagerbestand. Sollte ein Buch in dem Ausnahmefall als verfügbar angezeigt sein, nach deinem Kauf aber nicht mehr verfügbar sein, teilen wir dir das mit und erstatten dir den entsprechenden Betrag.</p>`
				},
				{
					heading: 'Versand, Gewährleistung und Rückgabe',
					body: `<p>Die Versandbedingungen sowie die Gewährleistungs- und Rückgaberichtlinie sind auf der Seite <a href="/de/envios-devoluciones">Versand und Rückgabe</a> ausführlich beschrieben.</p>`
				},
				{
					heading: 'Kontakt',
					body: `<p>Bei Fragen zu diesen Bedingungen schreib uns an ${email}.</p>`
				},
				{
					heading: 'Impressum',
					body: `<p>Handelsname: Bücherei Casa de Cuentos von M.E. Raffo<br />
						Rechtsform: Einzelunternehmen<br />
						Telefonnummer: 076 474 3828<br />
						E-Mail-Adresse: info@casadecuentos.ch<br />
						Adresse: Ahornweg 22, 8630 Rüti, Schweiz<br />
						Handelsregisternummer: CHE-496.195.964</p>`
				}
			]
		}
	},

	shipping: {
		es: {
			metaDescription: 'Cómo enviamos tus pedidos y nuestra política de devoluciones.',
			sections: [
				{
					heading: 'Envíos',
					body: `<p>Enviamos a toda Suiza a través de <strong>Correos Suizos (Swiss Post)</strong>.</p>
						<p>Preparamos los pedidos en los días siguientes a la confirmación del pago. Cuando tu pedido sale, te enviamos un correo con el <strong>número de seguimiento</strong> para que puedas seguir tu paquete.</p>`
				},
				{
					heading: 'Garantía: productos defectuosos o incorrectos',
					body: `<p>Respondemos por los defectos de los libros conforme al <strong>Código suizo de las obligaciones</strong>. Si recibes un libro <strong>defectuoso, dañado en el transporte o distinto del que pediste</strong>, contáctanos y te lo <strong>reemplazaremos</strong> (o, si no es posible, te reembolsaremos), sin coste para ti.</p>
						<p>Para reclamar, escríbenos a ${email} describiendo el problema, a ser posible con una foto, lo antes posible tras recibir el pedido.</p>`
				},
				{
					heading: 'Devoluciones por cambio de opinión',
					body: `<p>En Suiza <strong>no existe un derecho legal de desistimiento</strong> para las compras en línea. Por ello <strong>no aceptamos devoluciones por cambio de opinión</strong>: te pedimos que revises tu selección antes de confirmar el pago. Esta política no afecta a tus derechos de garantía descritos arriba para productos defectuosos o incorrectos.</p>`
				}
			]
		},
		de: {
			metaDescription: 'Wie wir deine Bestellungen versenden und unsere Rückgaberichtlinie.',
			sections: [
				{
					heading: 'Versand',
					body: `<p>Wir versenden in die ganze Schweiz über die <strong>Schweizerische Post (Swiss Post)</strong>.</p>
						<p>Wir bereiten die Bestellungen in den Tagen nach der Zahlungsbestätigung vor. Sobald deine Bestellung unterwegs ist, senden wir dir eine E-Mail mit der <strong>Sendungsnummer</strong>, damit du dein Paket verfolgen kannst.</p>`
				},
				{
					heading: 'Gewährleistung: fehlerhafte oder falsche Produkte',
					body: `<p>Wir haften für Mängel der Bücher gemäß dem <strong>Schweizerischen Obligationenrecht</strong>. Falls du ein <strong>fehlerhaftes, beim Transport beschädigtes oder ein anderes als das bestellte</strong> Buch erhältst, kontaktiere uns, und wir <strong>ersetzen</strong> es dir (oder erstatten dir, falls das nicht möglich ist, den Betrag), ohne Kosten für dich.</p>
						<p>Für eine Reklamation schreib uns an ${email} und beschreibe das Problem, nach Möglichkeit mit einem Foto, so bald wie möglich nach Erhalt der Bestellung.</p>`
				},
				{
					heading: 'Rückgabe bei Meinungsänderung',
					body: `<p>In der Schweiz gibt es <strong>kein gesetzliches Widerrufsrecht</strong> für Online-Käufe. Daher <strong>akzeptieren wir keine Rückgaben aufgrund einer Meinungsänderung</strong>: Wir bitten dich, deine Auswahl vor der Bestätigung der Zahlung zu überprüfen. Diese Regelung berührt nicht deine oben beschriebenen Gewährleistungsrechte bei fehlerhaften oder falschen Produkten.</p>`
				}
			]
		}
	}
};

// Resolve a legal page for a locale. Mirrors `t()`/`getAboutContent`:
// active locale → Spanish fallback (the page always resolves, never undefined).
export function getLegalPage(key: LegalPageKey, locale: Locale = DEFAULT_LOCALE): LegalPage {
	const page = content[key];
	return page[locale] ?? page[DEFAULT_LOCALE]!;
}
