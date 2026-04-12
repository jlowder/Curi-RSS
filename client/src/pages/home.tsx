import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { ArticleGrid } from "@/components/article-grid";
import { AddFeedModal } from "@/components/add-feed-modal";
import { EditFeedModal } from "@/components/edit-feed-modal";
import { SettingsModal } from "@/components/settings-modal";
import { FindFeedModal } from "@/components/find-feed-modal";
import type { Feed } from "@shared/schema";

export default function Home() {
  const [selectedFeedId, setSelectedFeedId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("unread");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddFeedModal, setShowAddFeedModal] = useState<boolean>(false);
  const [showEditFeedModal, setShowEditFeedModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showFindFeedModal, setShowFindFeedModal] = useState<boolean>(false);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridSize, setGridSize] = useState<number>(4);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Load grid size and category from localStorage/URL on mount
  useEffect(() => {
    const savedGridSize = localStorage.getItem("articleGridSize");
    if (savedGridSize) {
      setGridSize(parseInt(savedGridSize));
    }

    const savedViewMode = localStorage.getItem("viewMode");
    if (savedViewMode) {
      setViewMode(savedViewMode as "grid" | "list");
    }

    const searchParams = new URLSearchParams(window.location.search);
    const category = searchParams.get("category");
    const feed = searchParams.get("feed");

    if (category) {
      setSelectedCategory(category);
    }
    if (feed && feed !== "all") {
      setSelectedFeedId(feed);
    }
  }, []);

  // Save grid size to localStorage when it changes
  const handleGridSizeChange = (size: number) => {
    setGridSize(size);
    localStorage.setItem("articleGridSize", size.toString());
  };

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("viewMode", mode);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    // When changing category, preserve the feed selection.
    // The feed should only be reset when explicitly selecting "All Articles" from the sidebar.
  };

  const handleEditFeed = (feed: Feed) => {
    setEditingFeed(feed);
    setShowEditFeedModal(true);
  };

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-row overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        selectedFeedId={selectedFeedId}
        onSelectFeed={setSelectedFeedId}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryChange}
        onShowAddFeed={() => setShowAddFeedModal(true)}
        onShowFindFeed={() => setShowFindFeedModal(true)}
        onEditFeed={handleEditFeed}
        onShowSettings={() => setShowSettingsModal(true)}
      />
      <div className="flex-1 flex flex-col h-screen">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          selectedFeedId={selectedFeedId}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          gridSize={gridSize}
          onGridSizeChange={handleGridSizeChange}
        />
        <ArticleGrid
          selectedFeedId={selectedFeedId}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          viewMode={viewMode}
          gridSize={gridSize}
        />
      </div>

      <AddFeedModal
        open={showAddFeedModal}
        onOpenChange={setShowAddFeedModal}
      />

      <EditFeedModal
        feed={editingFeed}
        open={showEditFeedModal}
        onOpenChange={setShowEditFeedModal}
      />

      <SettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
      />

      <FindFeedModal
        open={showFindFeedModal}
        onOpenChange={setShowFindFeedModal}
      />
    </div>
  );
}
