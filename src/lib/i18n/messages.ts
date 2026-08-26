import type { Locale } from './locales';

// UI string dictionary, keyed by locale then by message key. `t()` falls back
// to Spanish for any key missing in the active locale, so a partial `de` table
// is safe.
export const messages: Record<Locale, Record<string, string>> = {
	es: {
		'nav.home': 'Inicio',
		'nav.books': 'Libros',
		'nav.events': 'Actividades',
		'nav.videos': 'Entrevistas',
		'nav.about': 'Quienes somos',
		'nav.contact': 'Contacto',
		'nav.cart': 'Carrito',
		'nav.menu': 'Menú',
		'nav.openMenu': 'Abrir menú',
		'nav.closeMenu': 'Cerrar menú',

		'site.name': 'Casa de Cuentos',
		'home.tagline': 'Librería en línea de libros infantiles y juveniles.',

		// Landing page — hero carousel + featured strip
		'home.hero.label': 'Destacados',
		'home.hero.prev': 'Anterior',
		'home.hero.next': 'Siguiente',
		'home.hero.goTo': 'Ir a la diapositiva',
		'home.featured.heading': 'Libros destacados',

		// Header fuzzy search
		'search.open': 'Buscar',
		'search.close': 'Cerrar búsqueda',
		'search.label': 'Búsqueda de libros',
		'search.placeholder': 'Buscar por título, autor o ilustrador…',
		'search.noResults': 'No se encontraron libros.',
		'search.error': 'No se pudo cargar la búsqueda.',

		'books.heading': 'Libros',
		'books.empty': 'No hay libros disponibles por el momento.',
		'books.noResults': 'No se encontraron libros con estos filtros.',
		'books.outOfStock': 'Agotado',

		// Listing pagination
		'pagination.label': 'Paginación',
		'pagination.previous': 'Anterior',
		'pagination.next': 'Siguiente',
		'pagination.goToPage': 'Ir a la página',

		// Listing filters / search / sort
		'filter.age': 'Edad',
		'filter.genre': 'Género',
		'filter.publisher': 'Editorial',
		'filter.language': 'Idioma',
		'filter.search': 'Buscar',
		'filter.searchPlaceholder': 'Título, autor o ilustrador',
		'filter.sort': 'Ordenar',
		'filter.all': 'Todos',
		'filter.apply': 'Filtrar',
		'filter.clear': 'Limpiar',
		'filter.toggle': 'Filtros',
		'sort.newest': 'Más recientes',
		'sort.priceAsc': 'Precio: menor a mayor',
		'sort.priceDesc': 'Precio: mayor a menor',

		// Product detail
		'book.author': 'Autor',
		'book.illustrator': 'Ilustrador',
		'book.publisher': 'Editorial',
		'book.year': 'Año de publicación',
		'book.language': 'Idioma',
		'book.genre': 'Género',
		'book.ageBand': 'Edad recomendada',
		'book.format': 'Formato',
		'book.pages': 'Páginas',
		'book.size': 'Tamaño',
		'book.isbn': 'ISBN',
		'book.description': 'Descripción',
		'book.details': 'Detalles',
		'book.addToCart': 'Añadir al carrito',
		'book.added': 'Añadido',
		'book.maxInCart': 'Máximo en el carrito',
		'book.coverAlt': 'Portada de',

		// Age bands (taxonomy labels — localizable)
		'age.0-3': '0–3 años',
		'age.3-6': '3–6 años',
		'age.6-9': '6–9 años',
		'age.9-12': '9–12 años',
		'age.12+': '12+ / Juvenil',

		// Cart page
		'cart.heading': 'Carrito',
		'cart.added': 'Añadido al carrito',
		'cart.empty': 'Tu carrito está vacío.',
		'cart.browse': 'Explorar libros',
		'cart.quantity': 'Cantidad',
		'cart.decrease': 'Reducir cantidad',
		'cart.increase': 'Aumentar cantidad',
		'cart.remove': 'Quitar',
		'cart.clear': 'Vaciar carrito',
		'cart.subtotal': 'Subtotal',
		'cart.shipping': 'Envío',
		'cart.total': 'Total',
		'cart.deliverySpeed': 'Velocidad de entrega',
		'cart.delivery.economy': 'Económico (2–3 días)',
		'cart.delivery.priority': 'Prioritario (1 día)',
		'cart.shippingUnavailable': 'Se calcula al finalizar la compra',
		'cart.loading': 'Cargando…',
		'cart.error': 'No se pudo cargar el carrito.',
		'cart.checkout': 'Finalizar compra',
		'cart.checkingOut': 'Redirigiendo al pago…',
		'cart.checkoutError': 'No se pudo iniciar el pago. Inténtalo de nuevo.',
		'cart.outOfStockError': 'Algunos libros ya no están disponibles en la cantidad solicitada.',

		// Checkout return pages
		'pago.success.heading': '¡Gracias por tu compra!',
		'pago.success.body':
			'Estamos procesando tu pago. Recibirás un correo de confirmación en breve.',
		'pago.cancel.heading': 'Pago cancelado',
		'pago.cancel.body': 'No se realizó ningún cargo. Tu carrito sigue disponible.',
		'pago.backToCart': 'Volver al carrito',
		'pago.keepBrowsing': 'Seguir explorando',

		// Order-confirmation email. Sent in Spanish from the payment webhook; keys
		// (not hardcoded strings) so a future `de` table localizes the same template.
		'email.confirm.subject': 'Confirmación de pedido',
		'email.confirm.greeting': 'Gracias por tu compra en Casa de Cuentos.',
		'email.confirm.intro': 'Hemos recibido tu pago y estamos preparando tu pedido.',
		'email.confirm.orderNumber': 'Número de pedido',
		'email.confirm.items': 'Artículos',
		'email.confirm.quantity': 'Cantidad',
		'email.confirm.subtotal': 'Subtotal',
		'email.confirm.shipping': 'Envío',
		'email.confirm.total': 'Total',
		'email.confirm.closing':
			'Te enviaremos otro correo con el número de seguimiento cuando tu pedido salga.',
		'email.confirm.signature': 'Casa de Cuentos',
		'email.confirm.help': 'Si tienes alguna pregunta, responde a este correo o escríbenos a',
		'email.confirm.orderSummary': 'Resumen del pedido',

		'events.heading': 'Actividades',
		'events.empty': 'No hay actividades próximas por el momento.',
		'events.upcoming': 'Próximas actividades',
		'event.when': 'Fecha y hora',
		'event.where': 'Lugar',
		'event.timeSuffix': 'h',
		'event.backTolist': 'Volver a actividades',
		'event.mapLabel': 'Ubicación del evento',

		// RSVP form. Free events, no capacity/waitlist.
		'rsvp.heading': 'Reserva tu plaza',
		'rsvp.intro': 'Las plazas son gratuitas. Déjanos tus datos y te confirmaremos por correo.',
		'rsvp.name': 'Nombre',
		'rsvp.familyName': 'Apellido',
		'rsvp.email': 'Correo electrónico',
		'rsvp.phone': 'Teléfono',
		// Child-details block. Name/age are required; the last two are prompts, so
		// their labels carry the `rsvp.optional` suffix.
		'rsvp.childName': 'Nombre de la niña / niño',
		'rsvp.childAge': 'Edad de la niña / niño',
		'rsvp.favoriteBooks': 'Qué libros le gusta leer',
		'rsvp.comments': 'Otros comentarios',
		'rsvp.optional': '(opcional)',
		'rsvp.submit': 'Reservar plaza',
		'rsvp.submitting': 'Enviando…',
		'rsvp.success': '¡Gracias! Tu reserva está confirmada. Te hemos enviado un correo.',
		'rsvp.error': 'No se pudo completar la reserva. Inténtalo de nuevo.',
		// No longer "todos son obligatorios" — the last two child fields are optional.
		'rsvp.invalid': 'Por favor revisa los campos obligatorios.',

		// RSVP confirmation email. Sent in Spanish; bilingual-ready.
		'email.rsvp.subject': 'Confirmación de reserva',
		'email.rsvp.hello': 'Hola',
		'email.rsvp.greeting': 'Gracias por reservar tu plaza en Casa de Cuentos.',
		'email.rsvp.intro': 'Hemos registrado tu reserva para el siguiente evento:',
		'email.rsvp.event': 'Evento',
		'email.rsvp.when': 'Fecha y hora',
		'email.rsvp.where': 'Lugar',
		'email.rsvp.closing':
			'Te esperamos. Si no puedes asistir, por favor avisar 48 hs antes del evento. Desde ya muchas gracias.',
		'email.rsvp.signature': 'Casa de Cuentos',
		// Card section headings, shared by the attendee and owner RSVP emails.
		'email.rsvp.sectionEvent': 'Actividad',
		'email.rsvp.sectionContact': 'Contacto',
		'email.rsvp.sectionChild': 'Niña / niño',

		// RSVP notification email (sent to the owner, mirrors the attendee copy above).
		'email.rsvpOwner.subject': 'Nueva reserva',
		'email.rsvpOwner.intro': 'Se ha registrado una nueva reserva para esta actividad:',

		// Videos page + live-interview banner. YouTube link-out cards; "Entrevistas"
		// is an editorial nav label distinct from the `/videos` slug — the page holds
		// all channel videos, not only interviews.
		'videos.heading': 'Entrevistas y vídeos',
		'videos.metaDescription':
			'Lecturas, entrevistas y vídeos de Casa de Cuentos en nuestro canal de YouTube.',
		'videos.empty': 'Todavía no hay vídeos. Vuelve pronto.',
		'videos.liveLabel': 'Próxima entrevista en directo',
		'videos.liveBadge': 'En directo',
		'video.thumbnailAlt': 'Miniatura del vídeo',

		// Contact page + form
		'contact.heading': 'Contacto',
		'contact.intro': '¿Tienes una pregunta o buscas un libro? Escríbenos.',
		'contact.name': 'Nombre',
		'contact.email': 'Correo electrónico',
		'contact.subject': 'Asunto',
		'contact.message': 'Mensaje',
		'contact.submit': 'Enviar mensaje',
		'contact.submitting': 'Enviando…',
		'contact.success': '¡Gracias! Hemos recibido tu mensaje y te responderemos pronto.',
		'contact.invalid': 'Por favor revisa los campos: todos son obligatorios.',
		'contact.rateLimited': 'Has enviado demasiados mensajes. Inténtalo de nuevo más tarde.',
		'contact.error': 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
		'contact.reach': 'También puedes encontrarnos aquí',
		'contact.addressLabel': 'Dirección',
		'contact.emailLabel': 'Correo',
		'contact.instagramLabel': 'Instagram',

		// Contact-message email (sent to the owner).
		'email.contact.subject': 'Nuevo mensaje de contacto',
		'email.contact.intro': 'Has recibido un nuevo mensaje desde el formulario de contacto:',

		// Static content pages. Most page bodies are hardcoded Spanish prose in their
		// components; only titles/chrome flow through i18n. The "Quienes somos" body is
		// the exception — it lives in `about-content.ts` (greeting + paragraphs).
		'about.heading': 'Quienes somos',
		'about.metaDescription':
			'Casa de Cuentos es una librería en línea de libros infantiles y juveniles para la comunidad hispanohablante en Suiza.',
		'about.imageAlt': 'María Eugenia, fundadora de Casa de Cuentos',
		'privacy.heading': 'Política de privacidad',
		'terms.heading': 'Términos y condiciones',
		'shipping.heading': 'Envíos y devoluciones',

		// Footer: policy links + contact info + copyright.
		'footer.policies': 'Información',
		'footer.about': 'Quienes somos',
		'footer.privacy': 'Privacidad',
		'footer.terms': 'Términos',
		'footer.shipping': 'Envíos y devoluciones',
		'footer.contact': 'Contacto',
		'footer.contactHeading': 'Contacto',
		'footer.rights': 'Todos los derechos reservados.'
	},
	de: {
		'nav.home': 'Start',
		'nav.books': 'Bücher',
		'nav.events': 'Veranstaltungen',
		'nav.videos': 'Interviews',
		'nav.about': 'Über uns',
		'nav.contact': 'Kontakt',
		'nav.cart': 'Warenkorb',
		'nav.menu': 'Menü',
		'nav.openMenu': 'Menü öffnen',
		'nav.closeMenu': 'Menü schließen',

		'site.name': 'Casa de Cuentos',
		'home.tagline': 'Online-Buchhandlung für Kinder- und Jugendbücher.',

		// Landing page — hero carousel + featured strip
		'home.hero.label': 'Empfohlen',
		'home.hero.prev': 'Vorherige',
		'home.hero.next': 'Nächste',
		'home.hero.goTo': 'Zur Folie',
		'home.featured.heading': 'Empfohlene Bücher',

		// Header fuzzy search
		'search.open': 'Suchen',
		'search.close': 'Suche schließen',
		'search.label': 'Büchersuche',
		'search.placeholder': 'Nach Titel, Autor oder Illustrator suchen…',
		'search.noResults': 'Keine Bücher gefunden.',
		'search.error': 'Die Suche konnte nicht geladen werden.',

		'books.heading': 'Bücher',
		'books.empty': 'Derzeit sind keine Bücher verfügbar.',
		'books.noResults': 'Keine Bücher mit diesen Filtern gefunden.',
		'books.outOfStock': 'Ausverkauft',

		// Listing pagination
		'pagination.label': 'Seitennavigation',
		'pagination.previous': 'Zurück',
		'pagination.next': 'Weiter',
		'pagination.goToPage': 'Zur Seite',

		// Listing filters / search / sort
		'filter.age': 'Alter',
		'filter.genre': 'Genre',
		'filter.publisher': 'Verlag',
		'filter.language': 'Sprache',
		'filter.search': 'Suchen',
		'filter.searchPlaceholder': 'Titel, Autor oder Illustrator',
		'filter.sort': 'Sortieren',
		'filter.all': 'Alle',
		'filter.apply': 'Filtern',
		'filter.clear': 'Zurücksetzen',
		'filter.toggle': 'Filter',
		'sort.newest': 'Neueste',
		'sort.priceAsc': 'Preis: aufsteigend',
		'sort.priceDesc': 'Preis: absteigend',

		// Product detail
		'book.author': 'Autor',
		'book.illustrator': 'Illustrator',
		'book.publisher': 'Verlag',
		'book.year': 'Erscheinungsjahr',
		'book.language': 'Sprache',
		'book.genre': 'Genre',
		'book.ageBand': 'Empfohlenes Alter',
		'book.format': 'Format',
		'book.pages': 'Seiten',
		'book.size': 'Größe',
		'book.isbn': 'ISBN',
		'book.description': 'Beschreibung',
		'book.details': 'Details',
		'book.addToCart': 'In den Warenkorb',
		'book.added': 'Hinzugefügt',
		'book.maxInCart': 'Maximal im Warenkorb',
		'book.coverAlt': 'Cover von',

		// Age bands (taxonomy labels — localizable)
		'age.0-3': '0–3 Jahre',
		'age.3-6': '3–6 Jahre',
		'age.6-9': '6–9 Jahre',
		'age.9-12': '9–12 Jahre',
		'age.12+': '12+ / Jugendliche',

		// Cart page
		'cart.heading': 'Warenkorb',
		'cart.added': 'Zum Warenkorb hinzugefügt',
		'cart.empty': 'Dein Warenkorb ist leer.',
		'cart.browse': 'Bücher entdecken',
		'cart.quantity': 'Menge',
		'cart.decrease': 'Menge verringern',
		'cart.increase': 'Menge erhöhen',
		'cart.remove': 'Entfernen',
		'cart.clear': 'Warenkorb leeren',
		'cart.subtotal': 'Zwischensumme',
		'cart.shipping': 'Versand',
		'cart.total': 'Gesamt',
		'cart.deliverySpeed': 'Liefergeschwindigkeit',
		'cart.delivery.economy': 'Standard (2–3 Tage)',
		'cart.delivery.priority': 'Express (1 Tag)',
		'cart.shippingUnavailable': 'Wird beim Bezahlvorgang berechnet',
		'cart.loading': 'Wird geladen…',
		'cart.error': 'Der Warenkorb konnte nicht geladen werden.',
		'cart.checkout': 'Zur Kasse',
		'cart.checkingOut': 'Weiterleitung zur Zahlung…',
		'cart.checkoutError': 'Die Zahlung konnte nicht gestartet werden. Bitte versuche es erneut.',
		'cart.outOfStockError': 'Einige Bücher sind nicht mehr in der gewünschten Menge verfügbar.',

		// Checkout return pages
		'pago.success.heading': 'Vielen Dank für deinen Einkauf!',
		'pago.success.body':
			'Wir verarbeiten deine Zahlung. Du erhältst in Kürze eine Bestätigungs-E-Mail.',
		'pago.cancel.heading': 'Zahlung abgebrochen',
		'pago.cancel.body':
			'Es wurde keine Zahlung vorgenommen. Dein Warenkorb ist weiterhin verfügbar.',
		'pago.backToCart': 'Zurück zum Warenkorb',
		'pago.keepBrowsing': 'Weiter stöbern',

		// Order-confirmation email.
		'email.confirm.subject': 'Bestellbestätigung',
		'email.confirm.greeting': 'Vielen Dank für deinen Einkauf bei Casa de Cuentos.',
		'email.confirm.intro': 'Wir haben deine Zahlung erhalten und bereiten deine Bestellung vor.',
		'email.confirm.orderNumber': 'Bestellnummer',
		'email.confirm.items': 'Artikel',
		'email.confirm.quantity': 'Menge',
		'email.confirm.subtotal': 'Zwischensumme',
		'email.confirm.shipping': 'Versand',
		'email.confirm.total': 'Gesamt',
		'email.confirm.closing':
			'Sobald deine Bestellung versandt wurde, senden wir dir eine weitere E-Mail mit der Sendungsnummer.',
		'email.confirm.signature': 'Casa de Cuentos',
		'email.confirm.help': 'Bei Fragen antworte einfach auf diese E-Mail oder schreibe uns an',
		'email.confirm.orderSummary': 'Bestellübersicht',

		'events.heading': 'Veranstaltungen',
		'events.empty': 'Derzeit sind keine Veranstaltungen geplant.',
		'events.upcoming': 'Kommende Veranstaltungen',
		'event.when': 'Datum und Uhrzeit',
		'event.where': 'Ort',
		'event.timeSuffix': 'Uhr',
		'event.backTolist': 'Zurück zu den Veranstaltungen',
		'event.mapLabel': 'Veranstaltungsort',

		// RSVP form. Free events, no capacity/waitlist.
		'rsvp.heading': 'Sichere dir deinen Platz',
		'rsvp.intro':
			'Die Plätze sind kostenlos. Hinterlasse uns deine Daten und wir bestätigen dir per E-Mail.',
		'rsvp.name': 'Vorname',
		'rsvp.familyName': 'Nachname',
		'rsvp.email': 'E-Mail',
		'rsvp.phone': 'Telefon',
		// Child-details block. German uses the gender-neutral "Kind" rather than
		// mirroring the Spanish "niña / niño" pairing, which reads clumsy here.
		'rsvp.childName': 'Name des Kindes',
		'rsvp.childAge': 'Alter des Kindes',
		'rsvp.favoriteBooks': 'Welche Bücher liest es gerne',
		'rsvp.comments': 'Weitere Anmerkungen',
		'rsvp.optional': '(optional)',
		'rsvp.submit': 'Platz reservieren',
		'rsvp.submitting': 'Wird gesendet…',
		'rsvp.success':
			'Vielen Dank! Deine Reservierung ist bestätigt. Wir haben dir eine E-Mail gesendet.',
		'rsvp.error': 'Die Reservierung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
		'rsvp.invalid': 'Bitte überprüfe die Pflichtfelder.',

		// RSVP confirmation email.
		'email.rsvp.subject': 'Reservierungsbestätigung',
		'email.rsvp.hello': 'Hallo',
		'email.rsvp.greeting': 'Vielen Dank für deine Reservierung bei Casa de Cuentos.',
		'email.rsvp.intro': 'Wir haben deine Reservierung für die folgende Veranstaltung registriert:',
		'email.rsvp.event': 'Veranstaltung',
		'email.rsvp.when': 'Datum und Uhrzeit',
		'email.rsvp.where': 'Ort',
		'email.rsvp.closing':
			'Wir freuen uns auf dich. Falls du nicht teilnehmen kannst, bitten wir dich 48 Stunden vorher bescheid zu geben. Vielen Dank im Vorraus.',
		'email.rsvp.signature': 'Casa de Cuentos',
		// Card section headings, shared by the attendee and owner RSVP emails.
		'email.rsvp.sectionEvent': 'Veranstaltung',
		'email.rsvp.sectionContact': 'Kontakt',
		'email.rsvp.sectionChild': 'Kind',

		// RSVP notification email (sent to the owner).
		'email.rsvpOwner.subject': 'Neue Reservierung',
		'email.rsvpOwner.intro': 'Für diese Veranstaltung ist eine neue Reservierung eingegangen:',

		// Videos page + live-interview banner.
		'videos.heading': 'Interviews und Videos',
		'videos.metaDescription':
			'Lesungen, Interviews und Videos von Casa de Cuentos auf unserem YouTube-Kanal.',
		'videos.empty': 'Noch keine Videos. Schau bald wieder vorbei.',
		'videos.liveLabel': 'Nächstes Live-Interview',
		'videos.liveBadge': 'Live',
		'video.thumbnailAlt': 'Vorschaubild des Videos',

		// Contact page + form
		'contact.heading': 'Kontakt',
		'contact.intro': 'Hast du eine Frage oder suchst du ein Buch? Schreib uns.',
		'contact.name': 'Name',
		'contact.email': 'E-Mail',
		'contact.subject': 'Betreff',
		'contact.message': 'Nachricht',
		'contact.submit': 'Nachricht senden',
		'contact.submitting': 'Wird gesendet…',
		'contact.success': 'Vielen Dank! Wir haben deine Nachricht erhalten und antworten dir bald.',
		'contact.invalid': 'Bitte überprüfe die Felder: Alle sind erforderlich.',
		'contact.rateLimited':
			'Du hast zu viele Nachrichten gesendet. Bitte versuche es später erneut.',
		'contact.error': 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.',
		'contact.reach': 'Du erreichst uns auch hier',
		'contact.addressLabel': 'Adresse',
		'contact.emailLabel': 'E-Mail',
		'contact.instagramLabel': 'Instagram',

		// Contact-message email (sent to the owner).
		'email.contact.subject': 'Neue Kontaktnachricht',
		'email.contact.intro': 'Du hast eine neue Nachricht über das Kontaktformular erhalten:',

		// Static content pages.
		'about.heading': 'Über uns',
		'about.metaDescription':
			'Casa de Cuentos ist eine Online-Buchhandlung für Kinder- und Jugendbücher für die spanischsprachige Gemeinschaft in der Schweiz.',
		'about.imageAlt': 'María Eugenia, Gründerin von Casa de Cuentos',
		'privacy.heading': 'Datenschutzerklärung',
		'terms.heading': 'Allgemeine Geschäftsbedingungen',
		'shipping.heading': 'Versand und Rückgabe',

		// Footer: policy links + contact info + copyright.
		'footer.policies': 'Informationen',
		'footer.about': 'Über uns',
		'footer.privacy': 'Datenschutz',
		'footer.terms': 'AGB',
		'footer.shipping': 'Versand und Rückgabe',
		'footer.contact': 'Kontakt',
		'footer.contactHeading': 'Kontakt',
		'footer.rights': 'Alle Rechte vorbehalten.'
	}
};
