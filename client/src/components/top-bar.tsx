import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Search, Grid3X3, List, ZoomIn, ZoomOut, Menu, X } from "lucide-react";
import type { FeedWithUnreadCount, ArticleWithFeed, EmailConfig, PublishingSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TopBarProps {
  onMenuClick: () => void;
  selectedFeedId: string;
  selectedCategory: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
}

export function TopBar({ onMenuClick, selectedFeedId, selectedCategory, searchQuery, onSearchChange, viewMode, onViewModeChange, gridSize, onGridSizeChange }: TopBarProps) {
  const queryClient = useQueryClient();
  const [selectedToAddress, setSelectedToAddress] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<string>("");

  const { data: emailConfig } = useQuery<EmailConfig>({
    queryKey: ["/api/settings/email-config"],
  });

  const { data: publishingSettings } = useQuery<PublishingSettings>({
    queryKey: ["/api/settings/publishing"],
  });

  useEffect(() => {
    if (emailConfig?.toAddress) {
      setSelectedToAddress(emailConfig.toAddress);
    }
    if (publishingSettings) {
      if (publishingSettings.sendEpub) {
        setSelectedFormat("epub");
      } else if (publishingSettings.sendPdf) {
        setSelectedFormat("pdf");
      } else if (publishingSettings.sendHtml) {
        setSelectedFormat("html");
      } else if (publishingSettings.sendMd) {
        setSelectedFormat("md");
      }
    }
  }, [emailConfig, publishingSettings]);

  const publishMutation = useMutation({
    mutationFn: async (data: { toAddress: string; format: string }) => {
      return apiRequest("POST", "/api/queue/publish", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      toast({
        title: "Success",
        description: "Queue published successfully",
      });
    },
    onError: (err: any) => {
      const description = err.response?.data?.details || err.message || "Failed to publish queue";
      toast({
        title: "Error",
        description: description,
        variant: "destructive",
      });
    },
  });

  const { data: feeds = [] } = useQuery<FeedWithUnreadCount[]>({
    queryKey: ["/api/feeds"],
  });

  const { data: articles = [] } = useQuery<ArticleWithFeed[]>({
    queryKey: ["/api/articles", { search: searchQuery, feedId: selectedFeedId, category: selectedCategory }],
  });

  const selectedFeed = feeds.find(feed => feed.id === selectedFeedId);
  
  let displayTitle = "";
  if (selectedCategory === "unread") {
    displayTitle = selectedFeedId === "all" ? "All Articles" : selectedFeed?.title || "Unknown Feed";
  } else {
    displayTitle = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800 p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} data-testid="sidebar-toggle">
            <Menu className="h-6 w-6" />
          </Button>
          <h2 className="text-lg font-semibold text-white">{displayTitle}</h2>
          <span className="text-sm text-gray-400">
            {articles.length} articles
          </span>
        </div>

        <div className="flex-grow hidden md:flex justify-center">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
        </div>

        <div className="flex items-center space-x-2 md:space-x-4 flex-wrap gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 w-full sm:w-48 lg:w-80 pl-10 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full p-1 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Options */}
          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            <Button
              size="sm"
              variant="ghost"
              className={`p-2 ${viewMode === "grid" 
                ? "text-blue-500 bg-gray-700" 
                : "text-gray-400 hover:text-white"} hover:bg-gray-600`}
              onClick={() => onViewModeChange("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`p-2 ${viewMode === "list" 
                ? "text-blue-500 bg-gray-700" 
                : "text-gray-400 hover:text-white"} hover:bg-gray-600`}
              onClick={() => onViewModeChange("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Grid Size Slider - only show in grid view */}
          {viewMode === "grid" && (
            <div className="flex items-center space-x-3 bg-gray-800 rounded-lg p-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onGridSizeChange(Math.max(1, gridSize - 1))}
                disabled={gridSize <= 1}
                className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                aria-label="Decrease grid size"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <div className="flex items-center space-x-2">
                <Slider
                  value={[gridSize]}
                  onValueChange={(value) => onGridSizeChange(value[0])}
                  max={6}
                  min={1}
                  step={1}
                  className="w-20"
                  data-testid="slider-grid-size"
                />
                <span className="text-xs text-gray-400 w-6 text-center">{gridSize}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onGridSizeChange(Math.min(6, gridSize + 1))}
                disabled={gridSize >= 6}
                className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                aria-label="Increase grid size"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          )}

          {selectedCategory === "queued" && (
            <>
              <Select value={selectedToAddress} onValueChange={setSelectedToAddress}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select address" />
                </SelectTrigger>
                <SelectContent>
                  {emailConfig?.toAddress && <SelectItem value={emailConfig.toAddress}>{emailConfig.toAddress}</SelectItem>}
                  {emailConfig?.toAddressAlternate && <SelectItem value={emailConfig.toAddressAlternate}>{emailConfig.toAddressAlternate}</SelectItem>}
                  {emailConfig?.toAddressAlternate2 && <SelectItem value={emailConfig.toAddressAlternate2}>{emailConfig.toAddressAlternate2}</SelectItem>}
                </SelectContent>
              </Select>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {publishingSettings?.sendEpub && <SelectItem value="epub">EPUB</SelectItem>}
                  {publishingSettings?.sendPdf && <SelectItem value="pdf">PDF</SelectItem>}
                  {publishingSettings?.sendHtml && <SelectItem value="html">HTML</SelectItem>}
                  {publishingSettings?.sendMd && <SelectItem value="md">MD</SelectItem>}
                </SelectContent>
              </Select>
              <Button
                onClick={() => publishMutation.mutate({ toAddress: selectedToAddress, format: selectedFormat })}
                disabled={publishMutation.isPending || !selectedToAddress || !selectedFormat}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
