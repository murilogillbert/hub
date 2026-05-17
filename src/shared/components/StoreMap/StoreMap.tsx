import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { PartnerStore } from '@shared/types';
import { resolveImageUrl } from '@shared/api/client';
import './StoreMap.css';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface StoreMapProps {
  stores: PartnerStore[];
  height?: number;
  onStoreSelect?: (store: PartnerStore) => void;
  selectLabel?: string;
}

function FitBounds({ stores }: { stores: PartnerStore[] }) {
  const map = useMap();
  useEffect(() => {
    if (!stores.length) return;
    const bounds = L.latLngBounds(stores.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [stores, map]);
  return null;
}

export function StoreMap({
  stores,
  height = 360,
  onStoreSelect,
  selectLabel = 'Ver ofertas',
}: StoreMapProps) {
  const center: [number, number] = stores.length
    ? [stores[0].lat, stores[0].lng]
    : [-23.5505, -46.6333];

  return (
    <div className="store-map" style={{ height }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="store-map__inner">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds stores={stores} />
        {stores.map((store) => (
          <Marker key={store.id} position={[store.lat, store.lng]} icon={markerIcon}>
            <Popup>
              <div className="store-map__popup">
                {store.imageUrl && (
                  <img
                    className="store-map__popup-img"
                    src={resolveImageUrl(store.imageUrl)}
                    alt={store.name}
                  />
                )}
                <strong>{store.name}</strong>
                <small>{store.address}</small>
                <small>{store.city}/{store.state} · {store.category}</small>
                <div className="store-map__popup-actions">
                  {onStoreSelect ? (
                    <button
                      type="button"
                      className="store-map__btn store-map__btn--primary"
                      onClick={() => onStoreSelect(store)}
                    >
                      {selectLabel}
                    </button>
                  ) : (
                    <a
                      className="store-map__btn store-map__btn--primary"
                      href="/catalogo"
                    >
                      Ver catálogo
                    </a>
                  )}
                  <a
                    className="store-map__btn"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Como chegar
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
