import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Bookmark, 
  Clock,
  User,
  Calendar,
  Loader2,
  Sparkles,
  Send,
  Globe,
  Info,
  FlaskConical,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { truncate } from "@/lib/utils";
import type { ArticleWithFeed, LlmConfig } from "@shared/schema";
import { useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { CollapsibleSection } from "@/components/collapsible-section";
import { AiChatSection } from "@/components/ai-chat-section";

interface ArticleDetailProps {}

function SafeHtmlContent({ content }: { content: string | null }) {
  if (!content) {
    return <div className="text-gray-400">No content available</div>;
  }

  const clean = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code'],
    ALLOWED_ATTR: ['href']
  });

  return (
    <div
      className="text-gray-300 prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export default function ArticleDetail({}: ArticleDetailProps) {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState<string | null>(null);
  const [referencedInfo, setReferencedInfo] = useState<string | null>(null);
  const [deepResearch, setDeepResearch] = useState<string | null>(null);
  const [counterpoints, setCounterpoints] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const { data: article, isLoading, error, refetch } = useQuery<ArticleWithFeed>({
    queryKey: [`/api/articles/${id}`],
    enabled: !!id,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: llmConfig } = useQuery<LlmConfig>({
    queryKey: ["/api/settings/llm-config"],
  });

  const updateArticleMutation = useMutation({
    mutationFn: async (updates: { isRead?: boolean; isBookmarked?: boolean; isQueued?: boolean }) => {
      const response = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update article");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: [`/api/articles/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/articles/${id}/summarize`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Failed to summarize article");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSummary(data.summary);
    },
    onError: (error: Error) => {
      toast({
        title: "AI Summarization Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const counterpointsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/articles/${id}/counterpoints`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Failed to get counterpoints");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCounterpoints(data.counterpoints);
    },
    onError: (error: Error) => {
      toast({
        title: "AI Counterpoints Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const referencedInfoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/articles/${id}/additional-info`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Failed to get referenced info");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setReferencedInfo(data.additionalInfo);
    },
    onError: (error: Error) => {
      toast({
        title: "AI Info Extraction Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deepResearchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/articles/${id}/deep-research`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Failed to get deep research");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setDeepResearch(data.deepResearch);
    },
    onError: (error: Error) => {
      toast({
        title: "AI Deep Research Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mark article as read after viewing for a few seconds (if not already read)
  useEffect(() => {
    if (article && !article.isRead && article.content && article.content.length > 100) {
      const timer = setTimeout(() => {
        updateArticleMutation.mutate({ isRead: true });
      }, 3000); // Mark as read after 3 seconds of viewing with content

      return () => clearTimeout(timer);
    }
  }, [article, updateArticleMutation]);

  const handleBack = () => {
    const fromCategory = new URLSearchParams(window.location.search).get("from");
    if (fromCategory) {
      setLocation(`/?category=${fromCategory}`);
    } else {
      setLocation("/");
    }
  };

  const handleToggleRead = () => {
    if (article) {
      updateArticleMutation.mutate({ isRead: !article.isRead });
    }
  };

  const handleToggleBookmark = () => {
    if (article) {
      updateArticleMutation.mutate({ isBookmarked: !article.isBookmarked });
    }
  };

  const handleQueueArticle = () => {
    if (article) {
      updateArticleMutation.mutate({ isQueued: true });
    }
  };

  const handleOpenOriginal = () => {
    if (article) {
      window.open(article.url, "_blank", "noopener,noreferrer");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-xl text-gray-400">Loading article...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-6 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to articles
          </Button>
          <Card className="bg-gray-800 border-gray-700 p-8 text-center">
            <div className="text-gray-400 mb-4">
              <div className="text-xl mb-2">Article not found</div>
              <div className="text-sm">The article you're looking for doesn't exist or has been removed.</div>
            </div>
            <Button onClick={handleBack} variant="default">
              Return to articles
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date | null | string) => {
    if (!date) return "Unknown date";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Unknown date";
    return format(dateObj, "MMMM d, yyyy 'at' h:mm a");
  };

  const hasContent = article.content && article.content.length > 100;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header with navigation and actions */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="text-gray-400 hover:text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to articles
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleQueueArticle}
              disabled={article.isQueued || updateArticleMutation.isPending}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
              title={article.isQueued ? "Article is in queue" : "Add to queue"}
              data-testid="button-queue-article"
            >
              <Send className="w-4 h-4" />
              <span className="ml-2 hidden sm:inline">
                {article.isQueued ? "Queued" : "Queue"}
              </span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleRead}
              disabled={updateArticleMutation.isPending}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
              title={article.isRead ? "Mark as unread" : "Mark as read"}
              data-testid="button-toggle-read"
            >
              {article.isRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">
                {article.isRead ? "Mark unread" : "Mark read"}
              </span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleBookmark}
              disabled={updateArticleMutation.isPending}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
              title={article.isBookmarked ? "Remove bookmark" : "Bookmark"}
              data-testid="button-toggle-bookmark"
            >
              <Bookmark
                className={`w-4 h-4 ${
                  article.isBookmarked ? "fill-yellow-500 text-yellow-500" : ""
                }`}
              />
              <span className="ml-2 hidden sm:inline">
                {article.isBookmarked ? "Saved" : "Save"}
              </span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenOriginal}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
              title="Open original article"
              data-testid="button-open-original"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="ml-2 hidden sm:inline">Original</span>
            </Button>
          </div>
        </div>

        {/* Article header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            {article.title}
          </h1>
          
          {/* Article meta information */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-6">
            {article.publishedAt && (
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(article.publishedAt)}
              </div>
            )}
            
            {article.author && (
              <div className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                {article.author}
              </div>
            )}
            
            {article.feed && (
                <div className="flex items-center">
                    <Globe className="w-4 h-4 mr-1" />
                    {article.feed.title}
                </div>
            )}
            {article.category && (
              <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                {article.category}
              </Badge>
            )}
          </div>

          {/* Article description */}
          {article.description && (
            <div className="text-lg text-gray-300 leading-relaxed mb-6">
              <SafeHtmlContent content={truncate(article.description, 128)} />
            </div>
          )}

          {/* Article image */}
          {article.imageUrl && (
            <div className="mb-8">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full max-h-96 object-cover rounded-lg shadow-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <Separator className="mb-8 bg-gray-700" />

        {/* Article content */}
        <Card className="bg-gray-800 border-gray-700 p-8">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-gray-400">Extracting full content...</span>
              </div>
              <div className="text-sm text-gray-500">
                This may take a moment while we fetch the complete article.
              </div>
            </div>
          ) : hasContent ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm text-gray-400 mb-6">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Full article content
                </div>
                {llmConfig?.enabled && (
                  <div className="flex flex-wrap items-center gap-2">
                    {llmConfig.summarizeEnabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => summarizeMutation.mutate()}
                        disabled={summarizeMutation.isPending}
                        className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {summarizeMutation.isPending ? "Summarizing..." : "AI Summary"}
                      </Button>
                    )}
                    {llmConfig.additionalInfoEnabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => referencedInfoMutation.mutate()}
                        disabled={referencedInfoMutation.isPending}
                        className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        <Info className="w-4 h-4 mr-2" />
                        {referencedInfoMutation.isPending ? "Getting Info..." : "Referenced Information"}
                      </Button>
                    )}
                    {llmConfig.deepResearchEnabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deepResearchMutation.mutate()}
                        disabled={deepResearchMutation.isPending}
                        className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        <FlaskConical className="w-4 h-4 mr-2" />
                        {deepResearchMutation.isPending ? "Generating..." : "Deep Research"}
                      </Button>
                    )}
                    {llmConfig.counterpointsEnabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => counterpointsMutation.mutate()}
                        disabled={counterpointsMutation.isPending}
                        className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        {counterpointsMutation.isPending ? "Generating..." : "Counterpoints"}
                      </Button>
                    )}
                    {llmConfig.discussEnabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChat(true)}
                        className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        AI Discuss
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {showChat && article && (
                <AiChatSection
                  articleId={article.id}
                  onClose={() => setShowChat(false)}
                />
              )}
              {summary && (
                <CollapsibleSection
                  title="Article Summary"
                  icon={<Sparkles className="w-5 h-5 text-yellow-400" />}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summary}
                  </ReactMarkdown>
                </CollapsibleSection>
              )}
              {referencedInfo && (
                <div className="mt-4">
                  <CollapsibleSection
                    title="Referenced Information"
                    icon={<Info className="w-5 h-5 text-blue-400" />}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {referencedInfo}
                    </ReactMarkdown>
                  </CollapsibleSection>
                </div>
              )}
              {deepResearch && (
                <div className="mt-4">
                  <CollapsibleSection
                    title="Deep Research Prompts"
                    icon={<FlaskConical className="w-5 h-5 text-green-400" />}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {deepResearch}
                    </ReactMarkdown>
                  </CollapsibleSection>
                </div>
              )}
              {counterpoints && (
                <div className="mt-4">
                  <CollapsibleSection
                    title="Counterpoints"
                    icon={<ShieldAlert className="w-5 h-5 text-orange-400" />}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {counterpoints}
                    </ReactMarkdown>
                  </CollapsibleSection>
                </div>
              )}
              <SafeHtmlContent content={article.content} />
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <ExternalLink className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <div className="text-lg mb-2">Full content not available</div>
                <div className="text-sm max-w-md mx-auto mb-4">
                  This article contains only a summary. The full content couldn't be extracted automatically.
                </div>
                {article.description && (
                  <div className="text-sm text-gray-300 max-w-md mx-auto mb-4 p-4 bg-gray-900 rounded border-l-4 border-blue-500">
                    <strong>Summary:</strong> <SafeHtmlContent content={article.description} />
                  </div>
                )}
              </div>
              <Button onClick={handleOpenOriginal} className="mt-4">
                <ExternalLink className="w-4 h-4 mr-2" />
                Read full article on source
              </Button>
            </div>
          )}
        </Card>

        {/* Footer actions */}
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            onClick={handleOpenOriginal}
            className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View original source
          </Button>
        </div>
      </div>
    </div>
  );
}
