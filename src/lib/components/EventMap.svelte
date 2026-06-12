<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	// Leaflet's default marker icons are referenced by relative URL and break under
	// a bundler; import the assets so Vite fingerprints them, then point the icon at
	// the resolved URLs. (Avoids the classic "broken marker image" Leaflet+Vite bug.)
	import markerIcon from 'leaflet/dist/images/marker-icon.png';
	import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
	import markerShadow from 'leaflet/dist/images/marker-shadow.png';

	// A keyless OpenStreetMap pin for one venue. Leaflet touches `window`/`document`,
	// so it must run client-side only — hence the dynamic import inside `onMount`
	// (this component is never reached during SSR). Per the PRD: Leaflet + OSM, free
	// and keyless, respecting OSM's tile-usage policy at our low volume (attribution
	// shown; default tile server only).
	let { latitude, longitude, label }: { latitude: number; longitude: number; label: string } =
		$props();

	let container: HTMLDivElement;

	onMount(() => {
		let map: import('leaflet').Map | undefined;

		(async () => {
			const L = await import('leaflet');

			const icon = L.icon({
				iconUrl: markerIcon,
				iconRetinaUrl: markerIcon2x,
				shadowUrl: markerShadow,
				iconSize: [25, 41],
				iconAnchor: [12, 41],
				popupAnchor: [1, -34],
				shadowSize: [41, 41]
			});

			map = L.map(container, {
				center: [latitude, longitude],
				zoom: 15,
				// Don't hijack page scroll when the pointer crosses the map.
				scrollWheelZoom: false
			});

			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			L.marker([latitude, longitude], { icon, title: label }).addTo(map);
		})();

		return () => map?.remove();
	});
</script>

<div
	bind:this={container}
	class="h-72 w-full rounded-lg border border-gray-200"
	role="img"
	aria-label={label}
></div>
