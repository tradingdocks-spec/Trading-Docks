"use client";

import { useEffect, useRef, useState } from "react";

type MapStore = { providerPlaceId: string; businessName: string; latitude: number | null; longitude: number | null };

type GoogleMapsWindow = Window & { google?: { maps?: any } };

function loadGoogleMaps(apiKey: string) {
  const existing = document.getElementById("trading-docks-google-maps") as HTMLScriptElement | null;
  if (existing && (window as GoogleMapsWindow).google?.maps) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.id = "trading-docks-google-maps";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps could not load. Check the browser key and HTTP referrer restrictions."));
    if (!existing) document.head.appendChild(script);
  });
}

export function StoreFinderMap({ stores, selectedId, onSelect }: { stores: MapStore[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const [mapState, setMapState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  useEffect(() => {
    if (!browserKey) { setMapState("missing-key"); return; }
    void loadGoogleMaps(browserKey).then(() => {
      const google = (window as GoogleMapsWindow).google;
      if (!mapElement.current || !google?.maps) throw new Error("Google Maps is unavailable.");
      map.current = new google.maps.Map(mapElement.current, { center: { lat: 39.8283, lng: -98.5795 }, zoom: 4, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
      setMapState("ready");
    }).catch(() => setMapState("error"));
  }, [browserKey]);

  useEffect(() => {
    if (mapState !== "ready" || !map.current) return;
    const google = (window as GoogleMapsWindow).google;
    if (!google?.maps) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current.clear();
    const visible = stores.filter((store) => store.latitude !== null && store.longitude !== null);
    if (!visible.length) { map.current.setCenter({ lat: 39.8283, lng: -98.5795 }); map.current.setZoom(4); return; }
    const bounds = new google.maps.LatLngBounds();
    visible.forEach((store, index) => {
      const position = { lat: store.latitude as number, lng: store.longitude as number };
      bounds.extend(position);
      const marker = new google.maps.Marker({ map: map.current, position, label: String(index + 1), title: store.businessName });
      marker.addListener("click", () => onSelect(store.providerPlaceId));
      markers.current.set(store.providerPlaceId, marker);
    });
    map.current.fitBounds(bounds, 56);
  }, [mapState, stores, onSelect]);

  useEffect(() => {
    const marker = selectedId ? markers.current.get(selectedId) : null;
    if (marker && map.current) { map.current.panTo(marker.getPosition()); marker.setAnimation((window as GoogleMapsWindow).google?.maps?.Animation?.BOUNCE); window.setTimeout(() => marker.setAnimation(null), 700); }
  }, [selectedId]);

  return <div className="relative h-full min-h-[420px] bg-[#0d1d2b]">
    <div ref={mapElement} className="absolute inset-0" aria-label="Google map of Store Finder results" />
    {mapState === "missing-key" ? <div className="absolute inset-0 grid place-items-center bg-[#0d1d2b] p-6 text-center"><div><p className="text-sm font-semibold text-white">Map configuration is incomplete</p><p className="mt-2 max-w-sm text-xs leading-5 text-white/65">Ask an administrator to configure NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY with Trading Docks HTTP referrer restrictions. Store search remains available.</p></div></div> : null}
    {mapState === "error" ? <div className="absolute inset-0 grid place-items-center bg-[#0d1d2b] p-6 text-center"><div><p className="text-sm font-semibold text-white">Google Maps could not load</p><p className="mt-2 max-w-sm text-xs leading-5 text-white/65">Check the browser key, Maps JavaScript API access, and allowed Trading Docks referrers.</p></div></div> : null}
    {!stores.length && mapState === "ready" ? <div className="absolute inset-0 grid place-items-center bg-[#0d1d2b]/80 p-6 text-center"><p className="text-sm text-white/65">Search a ZIP code to populate the territory map.</p></div> : null}
  </div>;
}
