export type AssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

interface MessageBubbleProps {
  message: AssistantMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === 'assistant';
  return (
    <div className={`assistant-row ${isAssistant ? 'is-bot' : 'is-user'}`}>
      <div className={`assistant-bubble ${isAssistant ? 'is-bot' : 'is-user'}`}>
        {message.text}
      </div>
    </div>
  );
}
