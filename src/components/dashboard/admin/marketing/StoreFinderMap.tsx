"use client";

import { useEffect, useRef, useState } from "react";

type MapStore = { providerPlaceId: string; businessName: string; latitude: number | null; longitude: number | null };
type GoogleMapsWindow = Window & { google?: { maps?: any }; gm_authFailure?: () => void; __tradingDocksMapsLoader?: MapsLoader };
type MapsLoader = { apiKey: string; callbackName: string; promise: Promise<void>; resolve: () => void; reject: (error: Error) => void; script: HTMLScriptElement; settled: boolean; previousAuthFailure?: () => void };
const MAPS_LOAD_TIMEOUT_MS = 12_000;

function finishLoader(loader: MapsLoader, outcome: "resolve" | "reject", error?: Error) {
  if (loader.settled) return;
  loader.settled = true;
  const browser = window as GoogleMapsWindow;
  delete (browser as unknown as Record<string, unknown>)[loader.callbackName];
  if (browser.gm_authFailure && browser.gm_authFailure !== loader.previousAuthFailure) browser.gm_authFailure = loader.previousAuthFailure;
  if (outcome === "reject") { loader.script.dataset.tdMapsStatus = "failed"; loader.reject(error ?? new Error("Google Maps failed to load.")); }
  else { loader.script.dataset.tdMapsStatus = "ready"; loader.resolve(); }
}

function loadGoogleMaps(apiKey: string) {
  const browser = window as GoogleMapsWindow;
  if (browser.google?.maps) return Promise.resolve();
  const existingLoader = browser.__tradingDocksMapsLoader;
  if (existingLoader?.apiKey === apiKey && !existingLoader.settled) return existingLoader.promise;

  const existingScript = document.getElementById("trading-docks-google-maps") as HTMLScriptElement | null;
  if (existingScript?.dataset.tdMapsStatus === "failed") existingScript.remove();
  if (existingScript?.dataset.tdMapsStatus === "ready" && !browser.google?.maps) existingScript.remove();
  if (existingScript && !existingScript.dataset.tdMapsCallback) existingScript.remove();
  const script = (existingScript && existingScript.isConnected ? existingScript : document.createElement("script"));
  const callbackName = script.dataset.tdMapsCallback ?? `__tradingDocksGoogleMapsReady_${Date.now()}`;
  let resolvePromise!: () => void;
  let rejectPromise!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  const loader: MapsLoader = { apiKey, callbackName, promise, resolve: resolvePromise, reject: rejectPromise, script, settled: false, previousAuthFailure: browser.gm_authFailure };
  browser.__tradingDocksMapsLoader = loader;
  script.id = "trading-docks-google-maps";
  script.dataset.tdMapsCallback = callbackName;
  script.dataset.tdMapsStatus = "loading";
  (browser as unknown as Record<string, unknown>)[callbackName] = () => finishLoader(loader, "resolve");
  browser.gm_authFailure = () => finishLoader(loader, "reject", new Error("Google Maps authentication failed."));
  const timeout = window.setTimeout(() => finishLoader(loader, "reject", new Error("Google Maps timed out while loading.")), MAPS_LOAD_TIMEOUT_MS);
  void promise.finally(() => window.clearTimeout(timeout)).catch(() => undefined);
  if (!script.src || !script.src.includes(`key=${encodeURIComponent(apiKey)}`)) script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${encodeURIComponent(callbackName)}`;
  script.async = true;
  script.defer = true;
  script.onerror = () => finishLoader(loader, "reject", new Error("Google Maps script failed to load."));
  if (!script.isConnected) document.head.appendChild(script);
  if (browser.google?.maps) finishLoader(loader, "resolve");
  return promise;
}

export function StoreFinderMap({ stores, selectedId, onSelect }: { stores: MapStore[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const [mapState, setMapState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  useEffect(() => {
    if (!browserKey) { setMapState("missing-key"); return; }
    let active = true;
    void loadGoogleMaps(browserKey).then(() => {
      const google = (window as GoogleMapsWindow).google;
      if (!active || !mapElement.current || !google?.maps) throw new Error("Google Maps is unavailable.");
      map.current = new google.maps.Map(mapElement.current, { center: { lat: 39.8283, lng: -98.5795 }, zoom: 4, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
      setMapState("ready");
    }).catch(() => { if (active) setMapState("error"); });
    return () => { active = false; };
  }, [browserKey]);

  useEffect(() => {
    if (mapState !== "ready" || !map.current) return;
    const google = (window as GoogleMapsWindow).google;
    if (!google?.maps) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current.clear();
    const coordinateStores = stores.map((store, originalIndex) => ({ store, originalIndex })).filter(({ store }) => store.latitude !== null && store.longitude !== null);
    if (!coordinateStores.length) { map.current.setCenter({ lat: 39.8283, lng: -98.5795 }); map.current.setZoom(4); return; }
    const bounds = new google.maps.LatLngBounds();
    coordinateStores.forEach(({ store, originalIndex }) => {
      const position = { lat: store.latitude as number, lng: store.longitude as number };
      bounds.extend(position);
      const marker = new google.maps.Marker({ map: map.current, position, label: String(originalIndex + 1), title: store.businessName });
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
    {mapState === "loading" ? <div className="absolute inset-0 grid place-items-center bg-[#0d1d2b] p-6 text-center"><p className="text-sm text-white/70">Loading territory map…</p></div> : null}
    {mapState === "missing-key" ? <div className="absolute inset-0 grid place-items-center bg-[#0d1d2b] p-6 text-center"><div><p className="text-sm font-semibold text-white">Map configuration is incomplete</p><p className="mt-2 max-w-sm text-xs leading-5 text-white/65">Ask an administrator to configure the browser map key with Trading Docks HTTP referrer restrictions. Store search remains available.</p></div></div> : null}
    {mapState === "error" ? <div className="absolute inset-0 grid place-items-center bg-[#0d1d2b] p-6 text-center"><div><p className="text-sm font-semibold text-white">Google Maps could not load.</p><p className="mt-2 max-w-sm text-xs leading-5 text-white/65">Check the Maps JavaScript browser key and allowed website referrers.</p><button type="button" onClick={() => { setMapState("loading"); window.location.reload(); }} className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">Retry map</button></div></div> : null}
    {!stores.length && mapState === "ready" ? <div className="absolute inset-0 grid place-items-center bg-[#0d1d2b]/80 p-6 text-center"><p className="text-sm text-white/65">No map results for this search.</p></div> : null}
  </div>;
}
