import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, User, Bot, MessageSquare, X, AlertCircle, RefreshCw } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatSectionProps {
  articleId: string;
  onClose: () => void;
}

export function AiChatSection({ articleId, onClose }: AiChatSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = useMutation({
    mutationFn: async (currentMessages: Message[]) => {
      setError(null);
      const response = await apiRequest("POST", `/api/articles/${articleId}/discuss`, {
        messages: currentMessages,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, data.message]);
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  // Start discussion on mount
  useEffect(() => {
    if (messages.length === 0) {
      chatMutation.mutate([]);
    }
  }, []);

  // Focus input when AI finishes thinking or an error occurs
  useEffect(() => {
    if (!chatMutation.isPending && (messages.length > 0 || error)) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [chatMutation.isPending, messages.length, error]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, chatMutation.isPending]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    chatMutation.mutate(newMessages);
  };

  const handleRetry = () => {
    chatMutation.mutate(messages);
  };

  return (
    <Card className="bg-gray-900 border-gray-700 mt-4 overflow-hidden flex flex-col h-[500px]">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
        <div className="flex items-center space-x-2 text-blue-400">
          <MessageSquare className="w-5 h-5" />
          <h3 className="font-semibold text-gray-100">AI Discussion</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[85%] space-x-2 ${
                  msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                }`}
              >
                <div className={`mt-1 p-1 rounded-full ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-blue-400" />}
                </div>
                <div
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 border border-gray-700 text-gray-200'
                  }`}
                >
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="flex space-x-2">
                <div className="mt-1 p-1 rounded-full bg-gray-700">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
                <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-400">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="flex space-x-2">
                <div className="mt-1 p-1 rounded-full bg-red-900/50">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </div>
                <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/50">
                  <p className="text-sm text-red-400 mb-2">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRetry}
                    className="h-7 text-xs border-red-900/50 hover:bg-red-900/20 text-red-400"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="p-4 bg-gray-800 border-t border-gray-700 flex space-x-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="bg-gray-950 border-gray-700 text-gray-200"
          disabled={chatMutation.isPending}
          autoFocus
        />
        <Button type="submit" size="sm" disabled={chatMutation.isPending || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
}
