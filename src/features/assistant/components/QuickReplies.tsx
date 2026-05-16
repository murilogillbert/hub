import { AssistantQuickReply } from '../lib/assistantFlow';

interface QuickRepliesProps {
  options: AssistantQuickReply[];
  onSelect: (value: string) => void;
}

export function QuickReplies({ options, onSelect }: QuickRepliesProps) {
  if (options.length === 0) return null;
  return (
    <div className="assistant-quick">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className="assistant-quick__chip"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
