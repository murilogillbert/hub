import { Link } from 'react-router-dom';
import './AuthPages.css';

export function RegisterChoicePage() {
  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <h2>Criar conta</h2>
        <p className="text-muted">Como você quer usar o OpenDriverHub?</p>

        <div className="auth-choice">
          <Link to="/cadastro/cliente" className="auth-choice__card">
            <span className="auth-choice__icon">🛍️</span>
            <strong>Sou Cliente</strong>
            <small>
              Comprar produtos e vouchers com cashback nos parceiros.
            </small>
          </Link>

          <Link to="/cadastro/parceiro" className="auth-choice__card">
            <span className="auth-choice__icon">🤝</span>
            <strong>Sou Parceiro</strong>
            <small>
              Vender para a base de clientes e acompanhar métricas.
            </small>
          </Link>
        </div>

        <p className="auth-page__alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
