import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Feed } from "@shared/schema";

interface EditFeedModalProps {
  feed: Feed | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFeedModal({ feed, open, onOpenChange }: EditFeedModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (feed) {
      setTitle(feed.title);
      setUrl(feed.url);
    }
  }, [feed]);

  const editFeedMutation = useMutation({
    mutationFn: async (data: { url: string; title?: string }) => {
      if (!feed) throw new Error("No feed to update");
      return apiRequest("PUT", `/api/feeds/${feed.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Feed updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update feed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;

    editFeedMutation.mutate({
      url: url.trim(),
      title: title.trim(),
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!editFeedMutation.isPending) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit RSS Feed</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm font-medium text-gray-300">
              Custom Name
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="My Custom Feed Name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
              disabled={editFeedMutation.isPending}
            />
          </div>

          <div>
            <Label htmlFor="url" className="text-sm font-medium text-gray-300">
              RSS Feed URL
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/rss.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
              disabled={editFeedMutation.isPending}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
              disabled={editFeedMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={editFeedMutation.isPending || !url.trim() || !title.trim()}
            >
              {editFeedMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
