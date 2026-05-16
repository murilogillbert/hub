import { StoresManager } from '@shared/components/StoresManager/StoresManager';
import './PartnerPages.css';

export function PartnerStoresPage() {
  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Unidades</h2>
          <p className="text-muted">
            Cadastre os pontos físicos que aparecem no mapa e nos locais de resgate.
          </p>
        </div>
      </header>

      <StoresManager mode="partner" />
    </div>
  );
}
