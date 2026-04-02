import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Plus,
  RefreshCw,
  CircleDot,
  BookOpen,
  Bookmark,
  Trash2,
  Pencil,
  Send,
  Settings,
  Search,
  X,
  CheckCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type {
  Feed,
  FeedWithUnreadCount,
  ArticleStats,
  FeedStats,
  LlmConfig,
} from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFeedId: string;
  onSelectFeed: (feedId: string) => void;
  onShowAddFeed: () => void;
  onShowFindFeed: () => void;
  onEditFeed: (feed: Feed) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onShowSettings: () => void;
}

interface FeedStatsTooltipProps {
  feedId: string;
  children: React.ReactNode;
}

const phrases = [
  "Feed your mind. Follow the trail.",
  "Your journey starts here.",
  "Go deeper.",
  "Go beyond the headlines.",
  "Rabbit holes ahead. Find one.",
  "Don't fear the deep end. Fear the shallow one.",
  "Curiosity is a trail. Follow it.",
  "Curiosity killed the cat. You're no cat.",
];

function FeedStatsTooltip({ feedId, children }: FeedStatsTooltipProps) {
  const { data: stats } = useQuery<FeedStats>({
    queryKey: ["/api/feeds", feedId, "stats"],
    queryFn: () =>
      fetch(`/api/feeds/${feedId}/stats`).then((res) => res.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (!stats) {
    return <>{children}</>;
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-1 text-sm">
          <div className="font-semibold">Feed Statistics</div>
          <div>Total Articles: {stats.totalArticles}</div>
          <div>Articles/Day: {stats.articlesPerDay}</div>
          <div>Days Active: {stats.daysSinceCreated}</div>
          {stats.lastArticleDate && (
            <div>Latest: {formatDate(stats.lastArticleDate)}</div>
          )}
          {stats.firstArticleDate && (
            <div>First: {formatDate(stats.firstArticleDate)}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  isOpen,
  onClose,
  selectedFeedId,
  onSelectFeed,
  onShowAddFeed,
  onShowFindFeed,
  onEditFeed,
  selectedCategory,
  onSelectCategory,
  onShowSettings,
}: SidebarProps) {
  const queryClient = useQueryClient();
  const [randomPhrase, setRandomPhrase] = useState("");

  useEffect(() => {
    setRandomPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  const {
    data: feeds = [],
    isLoading,
    refetch,
  } = useQuery<FeedWithUnreadCount[]>({
    queryKey: ["/api/feeds"],
  });

  const { data: stats } = useQuery<ArticleStats>({
    queryKey: ["/api/articles/stats"],
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return apiRequest("DELETE", `/api/feeds/${feedId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      toast({
        title: "Success",
        description: "Feed deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete feed",
        variant: "destructive",
      });
    },
  });

  const markFeedAsReadMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return apiRequest("POST", `/api/feeds/${feedId}/mark-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      toast({
        title: "Success",
        description: "Feed marked as read successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark feed as read",
        variant: "destructive",
      });
    },
  });

  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/feeds/refresh-all");
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      toast({
        title: "Success",
        description: "All feeds refreshed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to refresh feeds",
        variant: "destructive",
      });
    },
  });

  const handleDeleteFeed = (feedId: string, feedTitle: string) => {
    if (
      window.confirm(
        `Are you sure you want to unsubscribe from "${feedTitle}"? This will also delete all its articles.`,
      )
    ) {
      deleteFeedMutation.mutate(feedId);
      // If we're currently viewing this feed, switch to "all"
      if (selectedFeedId === feedId) {
        onSelectFeed("all");
      }
    }
  };

  const totalUnreadCount = feeds.reduce(
    (total, feed) => total + feed.unreadCount,
    0,
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-10 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={`absolute md:relative z-20 bg-gray-900 border-r border-gray-800 flex flex-col h-full w-max max-w-xs min-w-[280px] transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <a
                href="https://github.com/jlowder/Curi-RSS"
                target="_blank"
                rel="noopener noreferrer"
                className="w-20 flex-shrink-0"
              >
                <img
                  src="/white_rabbit.png"
                  alt="Curi-RSS"
                  className="w-full"
                />
              </a>
              <p className="text-sm text-gray-400 ml-4">{randomPhrase}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onClose}
              data-testid="sidebar-close"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={onShowAddFeed}
              variant="outline"
              title="Add a new feed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Feed
            </Button>
            <Button
              onClick={onShowFindFeed}
              variant="outline"
              title="Find new feeds"
            >
              <Search className="w-4 h-4 mr-2" />
              Find Feeds
            </Button>
          </div>
        </div>

        {/* Categories */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Category Navigation */}
            <div className="mb-4">
              <Button
                variant="ghost"
                className={`w-full justify-start p-3 mb-1 ${
                  selectedCategory === "unread"
                    ? "bg-gray-800 border-l-2 border-blue-500"
                    : "hover:bg-gray-800"
                }`}
                onClick={() => onSelectCategory("unread")}
              >
                <CircleDot className="w-4 h-4 mr-3 text-orange-500" />
                <span className="font-medium flex-1 text-left">Unread</span>
                {stats?.unreadCount !== undefined && (
                  <Badge
                    variant="secondary"
                    className="bg-orange-600 text-white"
                  >
                    {stats.unreadCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="ghost"
                className={`w-full justify-start p-3 mb-1 ${
                  selectedCategory === "read"
                    ? "bg-gray-800 border-l-2 border-blue-500"
                    : "hover:bg-gray-800"
                }`}
                onClick={() => onSelectCategory("read")}
              >
                <BookOpen className="w-4 h-4 mr-3 text-green-500" />
                <span className="font-medium flex-1 text-left">Read</span>
                {stats?.readCount !== undefined && (
                  <Badge variant="secondary" className="bg-gray-700 text-white">
                    {stats.readCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="ghost"
                className={`w-full justify-start p-3 mb-1 ${
                  selectedCategory === "saved"
                    ? "bg-gray-800 border-l-2 border-blue-500"
                    : "hover:bg-gray-800"
                }`}
                onClick={() => onSelectCategory("saved")}
              >
                <Bookmark className="w-4 h-4 mr-3 text-blue-500" />
                <span className="font-medium flex-1 text-left">Saved</span>
                {stats?.savedCount !== undefined && (
                  <Badge variant="secondary" className="bg-blue-600 text-white">
                    {stats.savedCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="ghost"
                className={`w-full justify-start p-3 mb-1 ${
                  selectedCategory === "queued"
                    ? "bg-gray-800 border-l-2 border-blue-500"
                    : "hover:bg-gray-800"
                }`}
                onClick={() => onSelectCategory("queued")}
              >
                <Send className="w-4 h-4 mr-3 text-purple-500" />
                <span className="font-medium flex-1 text-left">Queue</span>
                {stats?.queuedCount !== undefined && (
                  <Badge
                    variant="secondary"
                    className="bg-purple-600 text-white"
                  >
                    {stats.queuedCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Feed-specific content */}
            <>
              <div className="text-xs font-medium text-gray-400 px-3 py-2 uppercase tracking-wide">
                Subscriptions
              </div>
              <Button
                variant="ghost"
                className={`w-full justify-start p-3 mb-1 ${
                  selectedFeedId === "all"
                    ? "bg-gray-800 border-l-2 border-blue-500"
                    : "hover:bg-gray-800"
                }`}
                onClick={() => onSelectFeed("all")}
              >
                <Globe className="w-4 h-4 mr-3 text-blue-500" />
                <span className="font-medium flex-1 text-left">
                  All Articles
                </span>
                {selectedCategory === "unread" && totalUnreadCount > 0 && (
                  <Badge variant="secondary" className="bg-blue-600 text-white">
                    {totalUnreadCount}
                  </Badge>
                )}
              </Button>

              {/* Individual Feeds */}
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-gray-800 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                feeds.map((feed) => (
                  <div key={feed.id} className="group relative w-full">
                    <FeedStatsTooltip feedId={feed.id}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start p-3 mb-1 whitespace-normal ${
                          selectedFeedId === feed.id
                            ? "bg-gray-800 border-l-2 border-blue-500"
                            : "hover:bg-gray-800"
                        }`}
                        onClick={() => onSelectFeed(feed.id)}
                      >
                        <div className="w-6 h-6 rounded mr-3 bg-gray-700 flex items-center justify-center">
                          {feed.faviconUrl ? (
                            <img
                              src={feed.faviconUrl}
                              alt={feed.title}
                              className="w-4 h-4 rounded"
                            />
                          ) : (
                            <Globe className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="font-medium text-sm">
                            {feed.title}
                          </div>
                          <div className="text-xs text-gray-400 truncate">
                            {new URL(feed.url).hostname}
                          </div>
                        </div>
                        {selectedCategory === "unread" &&
                          feed.unreadCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-gray-700 text-white"
                            >
                              {feed.unreadCount}
                            </Badge>
                          )}
                      </Button>
                    </FeedStatsTooltip>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="p-1 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditFeed(feed);
                        }}
                        title={`Edit ${feed.title}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {feed.unreadCount > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-1 h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            markFeedAsReadMutation.mutate(feed.id);
                          }}
                          title={`Mark all articles in ${feed.title} as read`}
                          disabled={markFeedAsReadMutation.isPending}
                        >
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-500 p-1 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFeed(feed.id, feed.title);
                        }}
                        title={`Unsubscribe from ${feed.title}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-sm text-gray-400 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowSettings}
              className="text-gray-400 hover:text-white p-1 h-auto"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => refreshAllMutation.mutate()}
              disabled={refreshAllMutation.isPending}
              className="text-gray-400 hover:text-white disabled:opacity-50 flex-grow flex items-center justify-center text-lg"
              title={
                refreshAllMutation.isPending
                  ? "Refreshing feeds..."
                  : "Refresh all feeds"
              }
            >
              <span>{feeds.length} Feeds</span>
              <RefreshCw
                className={`w-20 h-20 ml-5 ${
                  refreshAllMutation.isPending ? "animate-spin" : ""
                }`}
              />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
