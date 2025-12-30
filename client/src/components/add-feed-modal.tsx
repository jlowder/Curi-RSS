import { useState } from "react";
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

interface AddFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFeedModal({ open, onOpenChange }: AddFeedModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const addFeedMutation = useMutation({
    mutationFn: async (data: { url: string; title?: string }) => {
      return apiRequest("POST", "/api/feeds", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/stats"] });
      setUrl("");
      setTitle("");
      onOpenChange(false);
      toast({
        title: "Success",
        description: "RSS feed added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add RSS feed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    addFeedMutation.mutate({
      url: url.trim(),
      title: title.trim() || undefined,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!addFeedMutation.isPending) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setUrl("");
        setTitle("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add RSS Feed</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={addFeedMutation.isPending}
            />
          </div>

          <div>
            <Label htmlFor="title" className="text-sm font-medium text-gray-300">
              Custom Name (Optional)
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="My Custom Feed Name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={addFeedMutation.isPending}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
              disabled={addFeedMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={addFeedMutation.isPending || !url.trim()}
            >
              {addFeedMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Feed"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
