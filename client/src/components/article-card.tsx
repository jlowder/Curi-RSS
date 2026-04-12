import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bookmark,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Send,
} from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { ArticleWithFeed } from "@shared/schema";

interface ArticleCardProps {
  article: ArticleWithFeed;
  viewMode?: "grid" | "list";
  selectedCategory: string;
  selectedFeedId: string;
}

export function ArticleCard({
  article,
  viewMode = "grid",
  selectedCategory,
  selectedFeedId,
}: ArticleCardProps) {
  const queryClient = useQueryClient();
  const [imageError, setImageError] = useState(false);
  const [, setLocation] = useLocation();

  const updateArticleMutation = useMutation({
    mutationFn: async (data: {
      isRead?: boolean;
      isBookmarked?: boolean;
      isQueued?: boolean;
    }) => {
      return apiRequest("PATCH", `/api/articles/${article.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update article",
        variant: "destructive",
      });
    },
  });

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateArticleMutation.mutate({ isBookmarked: !article.isBookmarked });
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateArticleMutation.mutate({ isRead: !article.isRead });
  };

  const handleQueueArticle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedCategory === "queued") {
      updateArticleMutation.mutate({ isQueued: false });
    } else {
      updateArticleMutation.mutate({ isQueued: true });
    }
  };

  const handleViewInternalArticle = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Just navigate to internal article view - don't mark as read yet
    // Include both feed and category in the URL to preserve selection
    setLocation(
      `/article/${article.id}?from=${selectedCategory}&feed=${selectedFeedId}`,
    );
  };

  const handleOpenExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Mark as read when clicked
    if (!article.isRead) {
      updateArticleMutation.mutate({ isRead: true });
    }
    // Open article in new tab
    window.open(article.url, "_blank", "noopener,noreferrer");
  };

  const handleCardClick = () => {
    // Default behavior - view article internally
    handleViewInternalArticle({
      stopPropagation: () => {},
    } as React.MouseEvent);
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return "Unknown";

    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(date).toLocaleDateString();
  };

  const getCategoryColor = (category: string | null) => {
    if (!category) return "bg-gray-600";

    const colors: Record<string, string> = {
      tech: "bg-blue-600",
      technology: "bg-blue-600",
      environment: "bg-green-600",
      space: "bg-purple-600",
      finance: "bg-yellow-600",
      health: "bg-red-600",
      politics: "bg-indigo-600",
      sports: "bg-orange-600",
      business: "bg-teal-600",
    };

    return colors[category.toLowerCase()] || "bg-gray-600";
  };

  // List view rendering
  if (viewMode === "list") {
    return (
      <Card
        className="bg-gray-800 hover:bg-gray-750 transition-all duration-200 hover:shadow-lg cursor-pointer group border-gray-700 overflow-hidden"
        onClick={handleCardClick}
      >
        <div className="flex h-24">
          {article.imageUrl && !imageError ? (
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-24 h-24 object-cover flex-shrink-0"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="w-6 h-6 text-gray-500" />
            </div>
          )}

          <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <h3
                  className={`font-semibold mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors flex-grow break-words ${
                    article.isRead ? "text-gray-400" : "text-white"
                  }`}
                >
                  {article.title}
                </h3>

                <div className="flex gap-1 ml-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleViewInternalArticle}
                    className="text-gray-400 hover:text-blue-400 p-1 h-auto"
                    title="Read article"
                    data-testid="button-view-internal"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleOpenExternal}
                    className="text-gray-400 hover:text-white p-1 h-auto"
                    title="Open original"
                    data-testid="button-open-external"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleToggleRead}
                    className="text-gray-400 hover:text-white p-1 h-auto"
                    title={article.isRead ? "Mark as unread" : "Mark as read"}
                    data-testid="button-toggle-read"
                  >
                    {article.isRead ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleBookmarkToggle}
                    className="text-gray-400 hover:text-white p-1 h-auto"
                    title={
                      article.isBookmarked ? "Remove bookmark" : "Bookmark"
                    }
                    data-testid="button-toggle-bookmark"
                  >
                    <Bookmark
                      className={`w-4 h-4 ${
                        article.isBookmarked
                          ? "fill-yellow-500 text-yellow-500"
                          : ""
                      }`}
                    />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleQueueArticle}
                    disabled={
                      selectedCategory !== "queued" && !!article.isQueued
                    }
                    className={`text-gray-400 hover:text-white p-1 h-auto ${article.isQueued ? "text-purple-500" : ""}`}
                    title={
                      article.isQueued ? "Article is in queue" : "Add to queue"
                    }
                    data-testid="button-queue-article"
                  >
                    <Send className="w-4 h-4" />
                    {article.isQueued && <span className="ml-1">Queued</span>}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center min-w-0">
                <div className="w-4 h-4 rounded mr-2 bg-gray-700 flex items-center justify-center flex-shrink-0">
                  {article.feed.faviconUrl ? (
                    <img
                      src={article.feed.faviconUrl}
                      alt={article.feed.title}
                      className="w-3 h-3 rounded"
                    />
                  ) : (
                    <div className="w-2 h-2 bg-gray-500 rounded" />
                  )}
                </div>
                <span className="truncate mr-4">{article.feed.title}</span>
                {article.category && (
                  <Badge
                    className={`${getCategoryColor(article.category)} text-white text-xs mr-2`}
                  >
                    {article.category}
                  </Badge>
                )}
              </div>
              <span className="flex-shrink-0">
                {formatTimeAgo(article.publishedAt)}
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Grid view rendering (default)
  return (
    <Card
      className="bg-gray-800 hover:bg-gray-750 transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer group border-gray-700 overflow-hidden"
      onClick={handleCardClick}
    >
      <div className="relative">
        {article.imageUrl && !imageError ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-40 object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <div className="text-center">
              <ExternalLink className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <div className="text-xs text-gray-500 px-2">
                {article.category || "Article"}
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleViewInternalArticle}
            className="bg-black bg-opacity-50 text-blue-400 p-1.5 rounded-full hover:bg-opacity-70 h-auto"
            title="Read article"
            data-testid="button-view-internal-grid"
          >
            <FileText className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenExternal}
            className="bg-black bg-opacity-50 text-white p-1.5 rounded-full hover:bg-opacity-70 h-auto"
            title="Open original"
            data-testid="button-open-external-grid"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleRead}
            className="bg-black bg-opacity-50 text-white p-1.5 rounded-full hover:bg-opacity-70 h-auto"
            title={article.isRead ? "Mark as unread" : "Mark as read"}
            data-testid="button-toggle-read-grid"
          >
            {article.isRead ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleBookmarkToggle}
            className="bg-black bg-opacity-50 text-white p-1.5 rounded-full hover:bg-opacity-70 h-auto"
            title={article.isBookmarked ? "Remove bookmark" : "Bookmark"}
            data-testid="button-toggle-bookmark-grid"
          >
            <Bookmark
              className={`w-4 h-4 ${
                article.isBookmarked ? "fill-yellow-500 text-yellow-500" : ""
              }`}
            />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleQueueArticle}
            disabled={selectedCategory !== "queued" && !!article.isQueued}
            className={`bg-black bg-opacity-50 text-white p-1.5 rounded-full hover:bg-opacity-70 h-auto ${article.isQueued ? "text-purple-500" : ""}`}
            title={article.isQueued ? "Article is in queue" : "Add to queue"}
            data-testid="button-queue-article-grid"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {article.category && (
          <div className="absolute bottom-2 left-2">
            <Badge
              className={`${getCategoryColor(article.category)} text-white text-xs`}
            >
              {article.category}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3
          className={`font-semibold mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors ${
            article.isRead ? "text-gray-400" : "text-white"
          }`}
        >
          {article.title}
        </h3>

        {article.description && (
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">
            {article.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center min-w-0">
            <div className="w-4 h-4 rounded mr-2 bg-gray-700 flex items-center justify-center flex-shrink-0">
              {article.feed.faviconUrl ? (
                <img
                  src={article.feed.faviconUrl}
                  alt={article.feed.title}
                  className="w-3 h-3 rounded"
                />
              ) : (
                <div className="w-2 h-2 bg-gray-500 rounded" />
              )}
            </div>
            <span className="truncate">{article.feed.title}</span>
          </div>
          <span className="flex-shrink-0 ml-2">
            {formatTimeAgo(article.publishedAt)}
          </span>
        </div>
      </div>
    </Card>
  );
}
