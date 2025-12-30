import { useQuery } from "@tanstack/react-query";
import { ArticleCard } from "./article-card";
import { Button } from "@/components/ui/button";
import type { ArticleWithFeed } from "@shared/schema";
import { useArticleSyncer } from "@/hooks/use-article-syncer";

interface ArticleGridProps {
  selectedFeedId: string;
  selectedCategory: string;
  searchQuery: string;
  viewMode: "grid" | "list";
  gridSize: number;
}

export function ArticleGrid({ selectedFeedId, selectedCategory, searchQuery, viewMode, gridSize }: ArticleGridProps) {
  useArticleSyncer();
  const { data: articles = [], isLoading } = useQuery<ArticleWithFeed[]>({
    queryKey: ["/api/articles", { search: searchQuery, feedId: selectedFeedId, category: selectedCategory }],
  });

  // Generate dynamic grid classes based on gridSize
  const getGridClasses = () => {
    if (viewMode === "list") return "space-y-4";
    
    const gridCols = {
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
      5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      6: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    };
    
    return `grid ${gridCols[gridSize as keyof typeof gridCols] || "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"} gap-6`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className={getGridClasses()}>
          {[...Array(gridSize * 2)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="bg-gray-700 h-40 rounded-lg mb-3" />
              <div className="bg-gray-700 h-4 rounded mb-2" />
              <div className="bg-gray-700 h-3 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-2">No articles found</div>
          {searchQuery && (
            <div className="text-sm text-gray-500">
              Try adjusting your search terms
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className={getGridClasses()}>
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} viewMode={viewMode} selectedCategory={selectedCategory} />
        ))}
      </div>

    </div>
  );
}
