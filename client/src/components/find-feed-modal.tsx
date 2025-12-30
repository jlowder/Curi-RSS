import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FoundFeed } from "@shared/schema";
import { Copy, Loader2, Eye } from "lucide-react";

interface PreviewArticle {
  title: string;
  url: string;
  publishedAt: string | null;
}

interface FindFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FindFeedModal({ open, onOpenChange }: FindFeedModalProps) {
  const [url, setUrl] = useState("");
  const [foundFeeds, setFoundFeeds] = useState<FoundFeed[]>([]);
  const [previewArticles, setPreviewArticles] = useState<PreviewArticle[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const findFeedsMutation = useMutation({
    mutationFn: async (url: string) => {
      return apiRequest("POST", "/api/feeds/find", { url });
    },
    onSuccess: async (response: Response) => {
      try {
        const data = await response.json();
        if (data && Array.isArray(data.feeds)) {
          setFoundFeeds(data.feeds);
          toast({
            title: "Success",
            description: "Feeds discovered successfully.",
          });
        } else {
          throw new Error("Invalid data format from server");
        }
      } catch (error) {
        setFoundFeeds([]);
        toast({
          title: "Error",
          description: "Failed to parse server response.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to find feeds.",
        variant: "destructive",
      });
    },
  });

  const previewFeedMutation = useMutation({
    mutationFn: async (feedUrl: string) => {
      return apiRequest("POST", "/api/feeds/preview", { feedUrl });
    },
    onSuccess: async (response: Response) => {
      try {
        const data = await response.json();
        if (data && Array.isArray(data.articles)) {
          setPreviewArticles(data.articles);
        } else {
          throw new Error("Invalid data format from server");
        }
      } catch (error) {
        setPreviewArticles([]);
        toast({
          title: "Error",
          description: "Failed to parse server response.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to preview feed.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsPreviewing(false);
    },
  });

  const handleFindFeeds = () => {
    setFoundFeeds([]);
    setPreviewArticles([]);
    findFeedsMutation.mutate(url);
  };

  const handlePreview = (feedUrl: string) => {
    setPreviewArticles([]);
    setIsPreviewing(true);
    previewFeedMutation.mutate(feedUrl);
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "URL copied to clipboard.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Find New Feeds</DialogTitle>
          <DialogDescription>
            Enter a website URL to find available RSS feeds.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <Button onClick={handleFindFeeds} disabled={findFeedsMutation.isPending}>
            {findFeedsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Find Feeds"
            )}
          </Button>
          {foundFeeds.length > 0 && (
            <div className="space-y-2">
              <Label>Found Feeds</Label>
              <ScrollArea className="h-48 rounded-md border p-4">
                {foundFeeds.map((feed) => (
                  <div key={feed.url} className="mb-4">
                    <div className="flex items-center justify-between">
                      <span className="break-all flex-1 mr-4 font-medium">{feed.url}</span>
                      <div>
                        <Button variant="ghost" size="sm" onClick={() => handlePreview(feed.url)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(feed.url)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{feed.title}</p>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
          {isPreviewing && (
            <div className="space-y-2">
              <Label>Feed Preview</Label>
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            </div>
          )}
          {previewArticles.length > 0 && (
            <div className="space-y-2">
              <Label>Feed Preview</Label>
              <ScrollArea className="h-48 rounded-md border p-4">
                {previewArticles.map((article) => (
                  <div key={article.url} className="mb-4">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {article.title}
                    </a>
                    <p className="text-sm text-gray-400 mt-1">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString()
                        : "No date"}
                    </p>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
