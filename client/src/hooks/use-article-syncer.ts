import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

// Poll for article stats every 30 seconds
const REFETCH_INTERVAL = 30 * 1000;

interface ArticleStats {
  unreadCount: number;
  readCount: number;
  savedCount: number;
  queuedCount: number;
}

export function useArticleSyncer() {
  const queryClient = useQueryClient();
  const prevStatsRef = useRef<{ total: number; unread: number }>();

  const { data: remoteStats } = useQuery<ArticleStats>({
    queryKey: ["/api/articles/stats"],
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const prevStats = prevStatsRef.current;

    if (remoteStats) {
      const currentTotal = remoteStats.readCount + remoteStats.unreadCount;
      const currentUnread = remoteStats.unreadCount;

      if (prevStats !== undefined) {
        const hasNewArticles = currentTotal > prevStats.total;
        const unreadCountChanged = currentUnread !== prevStats.unread;

        if (hasNewArticles || unreadCountChanged) {
          // Invalidate queries to refetch articles and feeds
          queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
          queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
        }
      }

      // Update the ref with the latest processed stats
      prevStatsRef.current = { total: currentTotal, unread: currentUnread };
    }
  }, [remoteStats, queryClient]);
}