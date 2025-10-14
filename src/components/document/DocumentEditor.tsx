import { useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./quill-custom.css";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight, Sparkles, FileText, Save, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { DocumentVersionModal } from "./DocumentVersionModal";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface DocumentEditorProps {
  showDocViewer?: boolean;
  onToggleViewer?: () => void;
  fileUrl?: string | null;
  fileName?: string | null;
  docId?: string | null;
  docContent?: string | null;
  conversationId?: string;
  userId?: string;
  onContextSelect?: (context: string, docId: string) => void;
}

export function DocumentEditor({ 
  showDocViewer = true, 
  onToggleViewer, 
  fileUrl = null, 
  fileName = null,
  docId = null,
  docContent = null,
  conversationId,
  userId,
  onContextSelect
}: DocumentEditorProps) {
  const { user } = useAuth();
  const quillRef = useRef<ReactQuill>(null);
  const clientId = useRef(Math.random().toString(36).substring(7));
  const [content, setContent] = useState(docContent || "");
  const [lastSavedContent, setLastSavedContent] = useState(docContent || "");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [showAskLawkit, setShowAskLawkit] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>(docContent ? 'edit' : 'view');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [versionCount, setVersionCount] = useState<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Load document content and version count
  useEffect(() => {
    if (docContent && typeof docContent === 'string' && docContent.trim()) {
      setContent(docContent);
      setViewMode('edit');
    } else if (fileUrl && typeof fileUrl === 'string') {
      setViewMode('view');
    } else {
      setViewMode('view');
      setContent('');
    }

    // Load version count
    if (docId && conversationId) {
      supabase
        .from('document_versions')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', docId)
        .eq('conversation_id', conversationId)
        .then(({ count }) => setVersionCount(count || 0));
    }
  }, [docContent, fileUrl, docId, conversationId]);

  // Real-time collaboration
  useEffect(() => {
    if (!docId || !user) return;

    const channel = supabase
      .channel(`doc-${docId}`)
      .on('broadcast', { event: 'doc_update' }, (payload) => {
        if (payload.payload.clientId !== clientId.current) {
          setContent(payload.payload.content);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [docId, user]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(content !== lastSavedContent);
  }, [content, lastSavedContent]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle text selection for "Ask Lawkit"
  const handleTextSelection = () => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection();
      if (range && range.length > 0) {
        const text = editor.getText(range.index, range.length);
        setSelectedText(text.trim());
        
        // Get selection position for popover
        const bounds = editor.getBounds(range.index, range.length);
        const editorContainer = quillRef.current.getEditingArea();
        if (editorContainer) {
          const rect = editorContainer.getBoundingClientRect();
          setSelectionPosition({
            top: rect.top + bounds.top + bounds.height + window.scrollY,
            left: rect.left + bounds.left + (bounds.width / 2) + window.scrollX,
          });
        }
        setShowAskLawkit(true);
      } else {
        setSelectedText("");
        setShowAskLawkit(false);
        setSelectionPosition(null);
      }
    }
  };

  const handleAskLawkit = () => {
    if (selectedText && onContextSelect && docId) {
      onContextSelect(selectedText, docId);
      setShowAskLawkit(false);
      setSelectedText("");
      toast({
        description: "Context added to prompt box",
      });
    }
  };

  const handleManualSave = async () => {
    if (!docId || !content || !conversationId || !userId || isSaving) {
      if (!docId || !content) {
        toast({
          title: "Save Failed",
          description: "No document to save",
          variant: "destructive",
        });
      }
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce: Add 300ms delay
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        const { error } = await supabase.functions.invoke('save-document-manual', {
          body: {
            docId,
            docContent: content,
            conversationId,
            userId
          }
        });

        if (error) throw error;

        // Refetch version count instead of incrementing
        const { count } = await supabase
          .from('document_versions')
          .select('id', { count: 'exact', head: true })
          .eq('document_id', docId)
          .eq('conversation_id', conversationId);

        setVersionCount(count || 0);
        toast({
          title: "Document Saved",
          description: "Your changes have been saved successfully",
        });
        setLastSaved(new Date());
        setLastSavedContent(content);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Error saving document manually:', error);
        toast({
          title: "Save Failed",
          description: "Failed to save document. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }, 300);
  };

  const handleRestore = async (restoredContent: string, restoredTitle: string | null) => {
    setContent(restoredContent);
    
    // Save the restored content as a new version
    await handleManualSave();
  };

  const handleExportDOCX = async () => {
    if (!content) {
      toast({
        description: "No content to export",
        variant: "destructive",
      });
      return;
    }

    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: fileName || 'Document',
              heading: HeadingLevel.HEADING_1,
            }),
            ...textContent.split('\n').filter(line => line.trim()).map(line =>
              new Paragraph({
                children: [new TextRun(line)],
              })
            ),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${docId || Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        description: "Document exported as DOCX successfully",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        description: "Failed to export document",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    if (!content) {
      toast({
        description: "No content to export",
        variant: "destructive",
      });
      return;
    }

    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - (margin * 2);
      
      // Add title
      pdf.setFontSize(16);
      pdf.text(fileName || 'Document', margin, 20);
      
      // Add content
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(textContent, maxWidth);
      let yPosition = 35;
      
      lines.forEach((line: string) => {
        if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 7;
      });

      pdf.save(`document-${docId || Date.now()}.pdf`);

      toast({
        description: "Document exported as PDF successfully",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        description: "Failed to export document",
        variant: "destructive",
      });
    }
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ font: [] }, { size: ["small", false, "large", "huge"] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ script: "sub" }, { script: "super" }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ align: [] }],
      ["blockquote", "code-block"],
      ["link", "image", "video"],
      ["clean"],
    ],
  };

  const formats = [
    "header", "font", "size", "bold", "italic", "underline", "strike",
    "color", "background", "script", "list", "bullet", "indent", "align",
    "blockquote", "code-block", "link", "image", "video"
  ];

  return (
    <div className="flex flex-col w-full h-full bg-background overflow-hidden">
      {/* Sticky Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onToggleViewer}
          >
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              showDocViewer ? "rotate-0" : "rotate-180"
            )} />
          </Button>
          <Button
            variant={viewMode === 'edit' ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-8"
            onClick={() => setViewMode('edit')}
            disabled={!docContent}
          >
            <FileText className="h-3.5 w-3.5 mr-2" />
            Edit Mode
          </Button>
          {viewMode === 'edit' && (
            <>
              <Button
                variant={showVersionModal ? "default" : "ghost"}
                size="sm"
                className="rounded-full h-8"
                onClick={() => setShowVersionModal(true)}
              >
                <Clock className="h-3.5 w-3.5 mr-2" />
                Versions ({versionCount})
              </Button>
              <Button
                variant="default"
                size="sm"
                className="rounded-full h-8"
                onClick={handleManualSave}
                disabled={isSaving || !docId || !hasUnsavedChanges}
              >
                <Save className="h-3.5 w-3.5 mr-2" />
                Save
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full h-8"
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPDF}>
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportDOCX}>
                    Export as DOCX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'edit' && docId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isSaving ? (
                <>
                  <Save className="h-3 w-3 animate-pulse" />
                  <span>Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Save className="h-3 w-3" />
                  <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto relative" onMouseUp={handleTextSelection}>
        {viewMode === 'view' ? (
          <div className="w-full h-full flex flex-col">
            {fileName && (
              <div className="px-4 py-2 bg-muted/50 border-b text-sm text-muted-foreground">
                Viewing: {fileName}
              </div>
            )}
            {fileUrl?.endsWith('.pdf') ? (
              <embed
                src={fileUrl}
                type="application/pdf"
                className="w-full flex-1 border-0"
                title={fileName || "Document Viewer"}
                onError={(e) => {
                  console.error('PDF embed failed, opening in new tab');
                  window.open(fileUrl, '_blank');
                }}
              />
            ) : fileUrl ? (
              <img 
                src={fileUrl} 
                alt={fileName || "Document"} 
                className="w-full h-auto object-contain p-4"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No document to display
              </div>
            )}
          </div>
        ) : (
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            className="h-full"
            style={{
              height: "calc(100% - 42px)",
            }}
          />
        )}

        {/* Ask Lawkit Popover */}
        {showAskLawkit && selectionPosition && selectedText && (
          <div 
            style={{
              position: 'fixed',
              top: selectionPosition.top,
              left: selectionPosition.left,
              transform: 'translate(-50%, -100%) translateY(-8px)',
              zIndex: 50,
            }}
          >
            <Button
              size="sm"
              onClick={handleAskLawkit}
              className="gap-2 shadow-lg"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Lawkit
            </Button>
          </div>
        )}
      </div>

      {/* Version History Modal */}
      <DocumentVersionModal
        open={showVersionModal}
        onOpenChange={setShowVersionModal}
        documentId={docId}
        conversationId={conversationId || undefined}
        currentContent={content}
        onRestore={handleRestore}
      />
    </div>
  );
}