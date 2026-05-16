import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  assistantWelcomeText,
  AssistantQuickReply,
} from '../lib/assistantFlow';
import {
  advanceAssistant,
  AssistantEngineState,
  createInitialAssistantState,
  getQuickRepliesForStep,
} from '../lib/localAssistantEngine';
import { createWhatsAppLeadUrl } from '../lib/whatsapp';
import {
  createLeadFromAssistant,
  recordBotInteraction,
} from '@shared/services/assistantApi';
import { MessageBubble, AssistantMessage } from './MessageBubble';
import { QuickReplies } from './QuickReplies';
import './FloatingAssistant.css';

type StoredAssistantSession = {
  engineState: AssistantEngineState;
  messages: AssistantMessage[];
  createdLeadId?: string;
};

const STORAGE_KEY = 'opendriverhub-assistant-session-v1';

const createMessage = (
  role: AssistantMessage['role'],
  text: string,
): AssistantMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  text,
});

const createInitialSession = (): StoredAssistantSession => ({
  engineState: createInitialAssistantState(),
  messages: [
    createMessage('assistant', assistantWelcomeText),
    createMessage('assistant', 'Para começar: como você quer usar o hub?'),
  ],
});

function loadInitialSession(): StoredAssistantSession {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored
      ? (JSON.parse(stored) as StoredAssistantSession)
      : createInitialSession();
  } catch {
    return createInitialSession();
  }
}

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<StoredAssistantSession>(() =>
    loadInitialSession(),
  );
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickReplies = useMemo<AssistantQuickReply[]>(
    () => getQuickRepliesForStep(session.engineState.step),
    [session.engineState.step],
  );

  const isReady = session.engineState.step === 'ready';

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.messages, isTyping, isOpen]);

  useEffect(() => {
    if (session.engineState.step !== 'ready' || session.createdLeadId) return;
    let cancelled = false;
    void createLeadFromAssistant(session.engineState.lead)
      .then((lead) => {
        if (!cancelled) {
          setSession((cur) =>
            cur.createdLeadId ? cur : { ...cur, createdLeadId: lead.id },
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.createdLeadId, session.engineState.lead, session.engineState.step]);

  const resetSession = () => {
    const initial = createInitialSession();
    setSession(initial);
    setInput('');
    setIsTyping(false);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  };

  const answerUser = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isTyping) return;
    setInput('');
    setSession((cur) => ({
      ...cur,
      messages: [...cur.messages, createMessage('user', trimmed)],
    }));
    setIsTyping(true);

    window.setTimeout(() => {
      setSession((cur) => {
        const result = advanceAssistant(cur.engineState, trimmed);
        const botMessages = result.responses.map((r) =>
          createMessage('assistant', r),
        );
        void recordBotInteraction({
          mensagemUsuario: trimmed,
          respostaBot: result.responses.join('\n'),
          etapaFluxo: cur.engineState.step,
          leadId: cur.createdLeadId,
          lead: result.lead,
        }).catch(() => undefined);

        return {
          ...cur,
          engineState: { step: result.step, lead: result.lead },
          messages: [...cur.messages, ...botMessages],
        };
      });
      setIsTyping(false);
    }, 520);
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    answerUser(input);
  };

  const openWhatsApp = () => {
    window.open(
      createWhatsAppLeadUrl(session.engineState.lead),
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir assistente do OpenDriverHub"
        className={`assistant-fab ${isOpen ? 'is-hidden' : ''}`}
      >
        <span className="assistant-fab__badge">AI</span>
        Assistente
      </button>

      <div
        className={`assistant-panel ${isOpen ? 'is-open' : ''}`}
        aria-hidden={!isOpen}
      >
        <header className="assistant-panel__header">
          <div>
            <p className="assistant-panel__tag">IA local</p>
            <h2>Assistente OpenDriverHub</h2>
          </div>
          <div className="assistant-panel__actions">
            <button type="button" onClick={resetSession}>
              Reiniciar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar assistente"
              className="assistant-panel__close"
            >
              ×
            </button>
          </div>
        </header>

        <div className="assistant-panel__body">
          {session.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {isTyping && (
            <div className="assistant-row is-bot">
              <div className="assistant-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {!isReady && !isTyping && (
            <QuickReplies options={quickReplies} onSelect={answerUser} />
          )}

          {isReady && !isTyping && (
            <div className="assistant-handoff">
              <p>
                Próximo passo: enviar seu resumo para um atendente humano no
                WhatsApp.
              </p>
              <button type="button" onClick={openWhatsApp}>
                Continuar pelo WhatsApp
              </button>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        <form onSubmit={submitMessage} className="assistant-panel__form">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            placeholder={
              isReady ? 'Resumo pronto para o WhatsApp' : 'Digite sua resposta...'
            }
          />
          <button
            type="submit"
            disabled={isTyping || input.trim().length === 0}
          >
            Enviar
          </button>
        </form>
      </div>
    </>
  );
}
