import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Clock, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { diff_match_patch } from "diff-match-patch";
import "./document-diff.css";

interface DocumentVersion {
  id: string;
  version_number: number;
  doc_content: string;
  doc_title: string | null;
  created_at: string;
}

interface DocumentVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  conversationId?: string;
  currentContent: string;
  onRestore: (content: string, title: string | null) => void;
}

export function DocumentVersionModal({
  open,
  onOpenChange,
  documentId,
  conversationId,
  currentContent,
  onRestore,
}: DocumentVersionModalProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    if (open && documentId && conversationId) {
      loadVersions();
    }
  }, [open, documentId, conversationId]);

  const loadVersions = async () => {
    if (!documentId || !conversationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .eq('conversation_id', conversationId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast({ description: "Failed to load version history", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: DocumentVersion) => {
    try {
      onRestore(version.doc_content, version.doc_title);
      toast({ description: `Restored to version ${version.version_number}` });
      onOpenChange(false);
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({ description: "Failed to restore version", variant: "destructive" });
    }
  };

  const comparisonData = useMemo(() => {
    if (!compareMode || !selectedVersion) return null;
    
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(selectedVersion.doc_content, currentContent);
    dmp.diff_cleanupSemantic(diffs);
    
    // Generate highlighted HTML for both versions
    let oldVersionHtml = '';
    let newVersionHtml = '';
    
    diffs.forEach(([operation, text]) => {
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      
      if (operation === -1) {
        // Deleted from old version
        oldVersionHtml += `<div class="diff-removed">${escapedText}</div>`;
      } else if (operation === 1) {
        // Added in new version
        newVersionHtml += `<div class="diff-added">${escapedText}</div>`;
      } else {
        // Unchanged
        oldVersionHtml += escapedText;
        newVersionHtml += escapedText;
      }
    });
    
    return { oldVersionHtml, newVersionHtml };
  }, [compareMode, selectedVersion, currentContent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${compareMode ? 'max-w-6xl' : 'max-w-4xl'} max-h-[90vh]`}>
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>

        <div className={`grid ${compareMode && selectedVersion ? 'grid-cols-3' : 'grid-cols-2'} gap-4 h-[calc(90vh-8rem)]`}>
          {/* Version List */}
          <div className="border rounded-lg p-4 flex flex-col h-full">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading versions...</p>
              ) : versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No version history available</p>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedVersion?.id === version.id
                        ? 'bg-accent border-primary'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">Version {version.version_number}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(version);
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                    {version.doc_title && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {version.doc_title}
                      </p>
                    )}
                  </div>
                ))
              )}
              </div>
            </ScrollArea>
          </div>

          {/* Version Preview - Side by Side in Compare Mode */}
          {compareMode && selectedVersion && comparisonData ? (
            <>
              {/* Left Column: Old Version */}
              <div className="border rounded-lg p-4 flex flex-col h-full">
                <h3 className="font-medium mb-2 flex items-center justify-between">
                  <span>Version {selectedVersion.version_number}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompareMode(false)}
                  >
                    Single View
                  </Button>
                </h3>
                <ScrollArea className="h-full">
                  <div
                    className="prose prose-sm max-w-none pr-4"
                    dangerouslySetInnerHTML={{ __html: comparisonData.oldVersionHtml }}
                  />
                </ScrollArea>
              </div>

              {/* Right Column: Current Version */}
              <div className="border rounded-lg p-4 flex flex-col h-full">
                <h3 className="font-medium mb-2">Current Version</h3>
                <ScrollArea className="h-full">
                  <div
                    className="prose prose-sm max-w-none pr-4"
                    dangerouslySetInnerHTML={{ __html: comparisonData.newVersionHtml }}
                  />
                </ScrollArea>
              </div>
            </>
          ) : (
            /* Single Version Preview */
            <div className="border rounded-lg p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">
                  {selectedVersion ? `Version ${selectedVersion.version_number}` : 'Current Version'}
                </h3>
                {selectedVersion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompareMode(true)}
                  >
                    Compare
                  </Button>
                )}
              </div>
              <ScrollArea className="h-full">
                <div
                  className="prose prose-sm max-w-none pr-4"
                  dangerouslySetInnerHTML={{
                    __html: selectedVersion?.doc_content || currentContent,
                  }}
                />
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
