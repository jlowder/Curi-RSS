import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { EmailConfig, LlmConfig, PublishingSettings } from "@shared/schema";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const API_KEY_PLACEHOLDER = "••••••••";

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const queryClient = useQueryClient();
  const [emailConfig, setEmailConfig] = useState<Partial<EmailConfig>>({});
  const [llmConfig, setLlmConfig] = useState<Partial<LlmConfig>>({});
  const [publishingSettings, setPublishingSettings] = useState<Partial<PublishingSettings>>({});

  const { data: initialEmailConfig } = useQuery<EmailConfig>({
    queryKey: ["/api/settings/email-config"],
    enabled: open,
  });

  const { data: initialLlmConfig } = useQuery<LlmConfig>({
    queryKey: ["/api/settings/llm-config"],
    enabled: open,
  });

  const { data: initialPublishingSettings } = useQuery<PublishingSettings>({
    queryKey: ["/api/settings/publishing"],
    enabled: open,
  });

  useEffect(() => {
    if (open && initialEmailConfig) {
      setEmailConfig(initialEmailConfig);
    }
    if (open && initialLlmConfig) {
      setLlmConfig({
        ...initialLlmConfig,
        apiKey: initialLlmConfig.hasApiKey ? API_KEY_PLACEHOLDER : initialLlmConfig.apiKey
      });
    }
    if (open && initialPublishingSettings) {
      setPublishingSettings(initialPublishingSettings);
    }
  }, [open, initialEmailConfig, initialLlmConfig, initialPublishingSettings]);

  const updateEmailMutation = useMutation({
    mutationFn: async (newConfig: Partial<EmailConfig>) => {
      return apiRequest("POST", "/api/settings/email-config", newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email-config"] });
      toast({
        title: "Success",
        description: "Email settings updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update email settings",
        variant: "destructive",
      });
    },
  });

  const updateLlmMutation = useMutation({
    mutationFn: async (newConfig: Partial<LlmConfig>) => {
      const configToSend = { ...newConfig };
      if (configToSend.apiKey === API_KEY_PLACEHOLDER) {
        delete configToSend.apiKey;
      }
      return apiRequest("POST", "/api/settings/llm-config", configToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/llm-config"] });
      toast({
        title: "Success",
        description: "LLM settings updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update LLM settings",
        variant: "destructive",
      });
    },
  });

  const updatePublishingMutation = useMutation({
    mutationFn: async (newConfig: Partial<PublishingSettings>) => {
      return apiRequest("POST", "/api/settings/publishing", newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/publishing"] });
      toast({
        title: "Success",
        description: "Publishing settings updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update publishing settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateEmailMutation.mutate(emailConfig);
    updateLlmMutation.mutate(llmConfig);
    updatePublishingMutation.mutate(publishingSettings);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setEmailConfig(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) : value),
    }));
  };

  const handleLlmChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    const isNumber = type === 'number';
    // Don't save empty string for numbers, save undefined instead
    const parsedValue = isNumber ? (value === '' ? undefined : parseFloat(value)) : value;
    setLlmConfig(prev => ({ ...prev, [id]: parsedValue }));
  };

  const handleLlmBooleanChange = (id: keyof LlmConfig, checked: boolean) => {
    setLlmConfig(prev => ({ ...prev, [id]: checked }));
  };

  const handlePublishingChange = (id: keyof PublishingSettings, checked: boolean) => {
    setPublishingSettings(prev => ({ ...prev, [id]: checked }));
  };

  const isSaving = updateEmailMutation.isPending || updateLlmMutation.isPending || updatePublishingMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your application settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh] px-1">
            <Tabs defaultValue="email">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="publishing">Publishing</TabsTrigger>
                <TabsTrigger value="llm">LLM</TabsTrigger>
              </TabsList>
              <TabsContent value="email">
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromAddress">From Address</Label>
                    <Input id="fromAddress" type="email" value={emailConfig.fromAddress || ""} onChange={handleEmailChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toAddress">To Address</Label>
                    <Input id="toAddress" type="email" value={emailConfig.toAddress || ""} onChange={handleEmailChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toAddressAlternate">Alternate To Address</Label>
                    <Input id="toAddressAlternate" type="email" value={emailConfig.toAddressAlternate || ""} onChange={handleEmailChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toAddressAlternate2">Alternate To Address 2</Label>
                    <Input id="toAddressAlternate2" type="email" value={emailConfig.toAddressAlternate2 || ""} onChange={handleEmailChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input id="smtpHost" value={emailConfig.smtpHost || ""} onChange={handleEmailChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">SMTP Port</Label>
                    <Input id="smtpPort" type="number" value={emailConfig.smtpPort || ""} onChange={handleEmailChange} />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox id="smtpSecure" checked={emailConfig.smtpSecure || false} onCheckedChange={(checked) => setEmailConfig(prev => ({ ...prev, smtpSecure: !!checked }))} />
                    <Label htmlFor="smtpSecure">Use SSL/TLS</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP Username</Label>
                  <Input id="smtpUser" value={emailConfig.smtpUser || ""} onChange={handleEmailChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPass">SMTP Password</Label>
                  <Input id="smtpPass" type="password" autocomplete="current-password" value={emailConfig.smtpPass || ""} onChange={handleEmailChange} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="publishing">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Ebook Formats</Label>
                  <p className="text-sm text-muted-foreground">Select which formats to generate and email when publishing.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="sendEpub" checked={publishingSettings.sendEpub} onCheckedChange={(checked) => handlePublishingChange('sendEpub', !!checked)} />
                  <Label htmlFor="sendEpub">EPUB</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="sendHtml" checked={publishingSettings.sendHtml} onCheckedChange={(checked) => handlePublishingChange('sendHtml', !!checked)} />
                  <Label htmlFor="sendHtml">HTML</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="sendMd" checked={publishingSettings.sendMd} onCheckedChange={(checked) => handlePublishingChange('sendMd', !!checked)} />
                  <Label htmlFor="sendMd">Markdown</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="sendPdf" checked={publishingSettings.sendPdf} onCheckedChange={(checked) => handlePublishingChange('sendPdf', !!checked)} />
                  <Label htmlFor="sendPdf">PDF</Label>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="llm">
              <div className="space-y-4 py-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="enabled" checked={llmConfig.enabled} onCheckedChange={(checked) => handleLlmBooleanChange('enabled', !!checked)} />
                  <Label htmlFor="enabled">Enable AI Features</Label>
                </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="connection">
                  <AccordionTrigger>Connection Settings</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="endpoint">LLM API Endpoint</Label>
                        <Input id="endpoint" value={llmConfig.endpoint || ""} onChange={handleLlmChange} placeholder="http://localhost:8000/v1/chat/completions" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">LLM API Key (Optional)</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          autocomplete="current-password"
                          value={llmConfig.apiKey || ""}
                          onChange={handleLlmChange}
                          placeholder={llmConfig.hasApiKey ? "••••••••" : "Enter API Key"}
                        />
                        {llmConfig.hasApiKey && (
                          <p className="text-xs text-muted-foreground">
                            An API key is already stored. Enter a new one to overwrite it.
                          </p>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="prompt">
                  <AccordionTrigger>Summarization Prompt</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="prompt">Prompt Template</Label>
                      <Textarea
                        id="prompt"
                        value={llmConfig.prompt || ""}
                        onChange={handleLlmChange}
                        rows={6}
                        placeholder="Default prompt will be used if empty. The prompt should include '{article_text}' where the article content should be injected."
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="additionalInfo">
                  <AccordionTrigger>Additional Information Prompt</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="additionalInfoPrompt">Prompt Template</Label>
                      <Textarea
                        id="additionalInfoPrompt"
                        value={llmConfig.additionalInfoPrompt || ""}
                        onChange={handleLlmChange}
                        rows={6}
                        placeholder="Default prompt will be used if empty. The prompt should include '{article_text}' where the article content should be injected."
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="deepResearch">
                  <AccordionTrigger>Deep Research Prompt</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="deepResearchPrompt">Prompt Template</Label>
                      <Textarea
                        id="deepResearchPrompt"
                        value={llmConfig.deepResearchPrompt || ""}
                        onChange={handleLlmChange}
                        rows={6}
                        placeholder="Default prompt will be used if empty. The prompt should include '{article_text}' where the article content should be injected."
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="parameters">
                  <AccordionTrigger>Model Parameters</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="max_tokens">Max Tokens</Label>
                        <Input id="max_tokens" type="number" value={llmConfig.max_tokens || ""} onChange={handleLlmChange} placeholder="150" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="temperature">Temperature</Label>
                        <Input id="temperature" type="number" step="0.1" value={llmConfig.temperature || ""} onChange={handleLlmChange} placeholder="0.7" />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              </div>
            </TabsContent>
          </Tabs>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
