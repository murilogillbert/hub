import { FormEvent, useEffect, useRef, useState } from 'react';
import { assistantWelcomeText } from '../lib/assistantFlow';
import {
  advanceAssistant,
  AssistantEngineState,
  AssistantLead,
  createInitialAssistantState,
  getQuickRepliesForStep,
} from '../lib/localAssistantEngine';
import { createWhatsAppLeadUrl } from '../lib/whatsapp';
import {
  createLeadFromAssistant,
  recordBotInteraction,
} from '@shared/services/assistantApi';
import { assistantApi, ChatMessage } from '@shared/api/endpoints';
import { MessageBubble, AssistantMessage } from './MessageBubble';
import { QuickReplies } from './QuickReplies';
import './FloatingAssistant.css';

type Mode = 'llm' | 'local';

type Session = {
  mode: Mode;
  engineState: AssistantEngineState;
  messages: AssistantMessage[];
  createdLeadId?: string;
};

const STORAGE_KEY = 'opendriverhub-assistant-session-v2';

const STARTERS = [
  'Quero economizar nas compras',
  'Como funciona o cashback?',
  'O que tem de alimentação?',
];

const createMessage = (
  role: AssistantMessage['role'],
  text: string,
): AssistantMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  text,
});

const createInitialSession = (): Session => ({
  mode: 'llm',
  engineState: createInitialAssistantState(),
  messages: [createMessage('assistant', assistantWelcomeText)],
});

function loadInitialSession(): Session {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Session) : createInitialSession();
  } catch {
    return createInitialSession();
  }
}

/** Lead leve para o handoff de WhatsApp quando estamos no modo LLM. */
function leadFromConversation(messages: AssistantMessage[]): AssistantLead {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return {
    goal: lastUser?.text,
    score: 0,
    temperature: 'morno',
  };
}

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<Session>(() => loadInitialSession());
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.messages, isTyping, isOpen]);

  const resetSession = () => {
    const initial = createInitialSession();
    setSession(initial);
    setInput('');
    setIsTyping(false);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  };

  // Resposta pelo motor local de regras (fallback sem Groq).
  const respondLocal = (cur: Session, text: string): Session => {
    const result = advanceAssistant(cur.engineState, text);
    const botMessages = result.responses.map((r) =>
      createMessage('assistant', r),
    );
    void recordBotInteraction({
      mensagemUsuario: text,
      respostaBot: result.responses.join('\n'),
      etapaFluxo: cur.engineState.step,
      leadId: cur.createdLeadId,
      lead: result.lead,
    }).catch(() => undefined);
    if (result.step === 'ready' && !cur.createdLeadId) {
      void createLeadFromAssistant(result.lead).catch(() => undefined);
    }
    return {
      ...cur,
      mode: 'local',
      engineState: { step: result.step, lead: result.lead },
      messages: [...cur.messages, ...botMessages],
    };
  };

  const answerUser = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isTyping) return;
    setInput('');

    const withUser: AssistantMessage[] = [
      ...session.messages,
      createMessage('user', trimmed),
    ];
    setSession((cur) => ({ ...cur, messages: withUser }));
    setIsTyping(true);

    // Modo já degradado para local nesta sessão.
    if (session.mode === 'local') {
      window.setTimeout(() => {
        setSession((cur) => respondLocal(cur, trimmed));
        setIsTyping(false);
      }, 420);
      return;
    }

    try {
      const history: ChatMessage[] = withUser
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.text,
        }));
      const res = await assistantApi.chat(history);

      if (res.fallback || !res.reply) {
        // Sem Groq configurado → degrada para o motor local.
        setSession((cur) => respondLocal(cur, trimmed));
      } else {
        setSession((cur) => ({
          ...cur,
          messages: [...cur.messages, createMessage('assistant', res.reply)],
        }));
      }
    } catch {
      setSession((cur) => respondLocal(cur, trimmed));
    } finally {
      setIsTyping(false);
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void answerUser(input);
  };

  const openWhatsApp = () => {
    const lead =
      session.mode === 'local'
        ? session.engineState.lead
        : leadFromConversation(session.messages);
    window.open(
      createWhatsAppLeadUrl(lead),
      '_blank',
      'noopener,noreferrer',
    );
  };

  const showStarters = session.messages.filter((m) => m.role === 'user').length === 0;
  const localQuick =
    session.mode === 'local'
      ? getQuickRepliesForStep(session.engineState.step)
      : [];

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
            <p className="assistant-panel__tag">
              {session.mode === 'local' ? 'Modo local' : 'Assistente IA'}
            </p>
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

          {!isTyping && showStarters && (
            <QuickReplies
              options={STARTERS.map((s) => ({ label: s, value: s }))}
              onSelect={(v) => void answerUser(v)}
            />
          )}

          {!isTyping && localQuick.length > 0 && (
            <QuickReplies
              options={localQuick}
              onSelect={(v) => void answerUser(v)}
            />
          )}

          {!isTyping && !showStarters && (
            <div className="assistant-handoff">
              <p>Prefere falar com um atendente? Continue no WhatsApp.</p>
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
            placeholder="Escreva sua mensagem..."
          />
          <button type="submit" disabled={isTyping || input.trim().length === 0}>
            Enviar
          </button>
        </form>
      </div>
    </>
  );
}
