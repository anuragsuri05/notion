import AIChat from './AIChat';

export default function AIChatPage({ chatId }: { chatId?: string }) {
  return (
    <div className="ai-page">
      <AIChat chatId={chatId} />
    </div>
  );
}
