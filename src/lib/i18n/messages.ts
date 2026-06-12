import type { Locale } from './locales';

// UI string dictionary, keyed by locale then by message key. v1 fills `es`
// only; `de` is intentionally empty (filled in v2). `t()` falls back to Spanish
// for any key missing in the active locale, so an empty `de` table is safe.
export const messages: Record<Locale, Record<string, string>> = {
	es: {
		'nav.home': 'Inicio',
		'nav.books': 'Libros',
		'nav.events': 'Eventos',
		'nav.about': 'Nosotros',
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
		'book.coverAlt': 'Portada de',

		// Age bands (taxonomy labels — localizable)
		'age.0-3': '0–3 años',
		'age.3-6': '3–6 años',
		'age.6-9': '6–9 años',
		'age.9-12': '9–12 años',
		'age.12+': '12+ / Juvenil',

		// Cart page
		'cart.heading': 'Carrito',
		'cart.empty': 'Tu carrito está vacío.',
		'cart.browse': 'Explorar libros',
		'cart.quantity': 'Cantidad',
		'cart.decrease': 'Reducir cantidad',
		'cart.increase': 'Aumentar cantidad',
		'cart.remove': 'Quitar',
		'cart.clear': 'Vaciar carrito',
		'cart.total': 'Total',
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

		// Order-confirmation email (Phase 6b). Sent in Spanish from the payment
		// webhook; bilingual-ready (keys, not hardcoded strings, so a future `de`
		// table localizes the same template).
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

		// Events listing + detail (Phase 9)
		'events.heading': 'Eventos',
		'events.empty': 'No hay eventos próximos por el momento.',
		'events.upcoming': 'Próximos eventos',
		'event.when': 'Fecha y hora',
		'event.where': 'Lugar',
		'event.timeSuffix': 'h',
		'event.backTolist': 'Volver a eventos',
		'event.mapLabel': 'Ubicación del evento',

		// RSVP form (Phase 9). Free events, no capacity/waitlist.
		'rsvp.heading': 'Reserva tu plaza',
		'rsvp.intro': 'Las plazas son gratuitas. Déjanos tus datos y te confirmaremos por correo.',
		'rsvp.name': 'Nombre',
		'rsvp.familyName': 'Apellido',
		'rsvp.email': 'Correo electrónico',
		'rsvp.phone': 'Teléfono',
		'rsvp.submit': 'Reservar plaza',
		'rsvp.submitting': 'Enviando…',
		'rsvp.success': '¡Gracias! Tu reserva está confirmada. Te hemos enviado un correo.',
		'rsvp.error': 'No se pudo completar la reserva. Inténtalo de nuevo.',
		'rsvp.invalid': 'Por favor revisa los campos: todos son obligatorios.',

		// RSVP confirmation email (Phase 9). Sent in Spanish; bilingual-ready.
		'email.rsvp.subject': 'Confirmación de reserva',
		'email.rsvp.greeting': 'Gracias por reservar tu plaza en Casa de Cuentos.',
		'email.rsvp.intro': 'Hemos registrado tu reserva para el siguiente evento:',
		'email.rsvp.event': 'Evento',
		'email.rsvp.when': 'Fecha y hora',
		'email.rsvp.where': 'Lugar',
		'email.rsvp.closing': 'Te esperamos. Si no puedes asistir, no necesitas hacer nada.',
		'email.rsvp.signature': 'Casa de Cuentos',

		// Contact page + form (Phase 10)
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

		// Contact-message email (sent to the owner; Phase 10).
		'email.contact.subject': 'Nuevo mensaje de contacto',
		'email.contact.intro': 'Has recibido un nuevo mensaje desde el formulario de contacto:',

		// Static content pages (Phase 10). Page bodies are hardcoded Spanish prose
		// in their components; only titles/chrome flow through i18n.
		'about.heading': 'Nosotros',
		'privacy.heading': 'Política de privacidad',
		'terms.heading': 'Términos y condiciones',
		'shipping.heading': 'Envíos y devoluciones',

		// Footer (Phase 10): policy links + contact info + copyright.
		'footer.policies': 'Información',
		'footer.about': 'Nosotros',
		'footer.privacy': 'Privacidad',
		'footer.terms': 'Términos',
		'footer.shipping': 'Envíos y devoluciones',
		'footer.contact': 'Contacto',
		'footer.contactHeading': 'Contacto',
		'footer.rights': 'Todos los derechos reservados.'
	},
	de: {}
};
