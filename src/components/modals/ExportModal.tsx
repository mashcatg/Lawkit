import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, FileDown } from "lucide-react";
import { useState } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { toast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationTitle?: string;
  messages?: Array<{ role: string; content: string; timestamp?: string }>;
  documentContent?: string;
  documentTitle?: string;
}

export function ExportModal({ 
  open, 
  onOpenChange, 
  conversationTitle = "Conversation",
  messages = [],
  documentContent,
  documentTitle 
}: ExportModalProps) {
  const [includeChat, setIncludeChat] = useState(true);
  const [includeDocument, setIncludeDocument] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(false);

  const handleExport = async (format: "docx" | "pdf") => {
    try {
      if (format === "pdf") {
        const pdf = new jsPDF();
        let yPos = 20;
        const margin = 15;
        const lineHeight = 7;
        const pageHeight = pdf.internal.pageSize.height;

        // Add title
        pdf.setFontSize(20);
        pdf.text(conversationTitle, margin, yPos);
        yPos += lineHeight * 2;

        // Add chat conversation if included
        if (includeChat && messages.length > 0) {
          pdf.setFontSize(16);
          pdf.text("Conversation", margin, yPos);
          yPos += lineHeight * 1.5;

          pdf.setFontSize(11);
          messages.forEach((msg) => {
            const roleText = msg.role === 'user' ? 'You' : 'Assistant';
            const text = `${roleText}: ${msg.content}`;
            
            const lines = pdf.splitTextToSize(text, pdf.internal.pageSize.width - margin * 2);
            lines.forEach((line: string) => {
              if (yPos > pageHeight - margin) {
                pdf.addPage();
                yPos = margin;
              }
              pdf.text(line, margin, yPos);
              yPos += lineHeight;
            });

            if (includeMetadata && msg.timestamp) {
              if (yPos > pageHeight - margin) {
                pdf.addPage();
                yPos = margin;
              }
              pdf.setFontSize(9);
              pdf.text(`Time: ${msg.timestamp}`, margin + 10, yPos);
              yPos += lineHeight;
              pdf.setFontSize(11);
            }
            yPos += 3;
          });
        }

        // Add document content if included
        if (includeDocument && documentContent) {
          if (yPos > pageHeight - margin * 3) {
            pdf.addPage();
            yPos = margin;
          }

          pdf.setFontSize(16);
          pdf.text(documentTitle || "Document", margin, yPos);
          yPos += lineHeight * 1.5;

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = documentContent;
          const textContent = tempDiv.textContent || tempDiv.innerText || '';
          
          pdf.setFontSize(11);
          const lines = pdf.splitTextToSize(textContent, pdf.internal.pageSize.width - margin * 2);
          lines.forEach((line: string) => {
            if (yPos > pageHeight - margin) {
              pdf.addPage();
              yPos = margin;
            }
            pdf.text(line, margin, yPos);
            yPos += lineHeight;
          });
        }

        pdf.save(`${conversationTitle}.pdf`);
        toast({ description: 'Conversation exported as PDF successfully' });
        onOpenChange(false);
        return;
      }

      // DOCX export
      const children: any[] = [];

      // Add title
      children.push(
        new Paragraph({
          text: conversationTitle,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Add chat conversation if included
      if (includeChat && messages.length > 0) {
        children.push(
          new Paragraph({
            text: "Conversation",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          })
        );

        messages.forEach((msg) => {
          const roleText = msg.role === 'user' ? 'You' : 'Assistant';
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${roleText}: `,
                  bold: true,
                }),
                new TextRun(msg.content),
              ],
              spacing: { after: 200 },
            })
          );

          if (includeMetadata && msg.timestamp) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Time: ${msg.timestamp}`,
                    italics: true,
                  }),
                ],
                spacing: { after: 200 },
              })
            );
          }
        });
      }

      // Add document content if included
      if (includeDocument && documentContent) {
        children.push(
          new Paragraph({
            text: documentTitle || "Document",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          })
        );

        // Convert HTML to plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = documentContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        textContent.split('\n').filter(line => line.trim()).forEach(line => {
          children.push(
            new Paragraph({
              text: line,
              spacing: { after: 100 },
            })
          );
        });
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${conversationTitle}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ description: 'Conversation exported successfully' });
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({ description: 'Failed to export conversation', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Export Conversation</DialogTitle>
          <DialogDescription>
            Choose what to include and select your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-chat"
                checked={includeChat}
                onCheckedChange={(checked) => setIncludeChat(checked as boolean)}
              />
              <Label htmlFor="include-chat" className="cursor-pointer">
                Include chat conversation
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-document"
                checked={includeDocument}
                onCheckedChange={(checked) => setIncludeDocument(checked as boolean)}
                disabled={!documentContent}
              />
              <Label htmlFor="include-document" className="cursor-pointer">
                Include document content {!documentContent && "(No document available)"}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-metadata"
                checked={includeMetadata}
                onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
              />
              <Label htmlFor="include-metadata" className="cursor-pointer">
                Include metadata (timestamps, versions)
              </Label>
            </div>
          </div>

          {/* Export Format Buttons */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Select format:</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 flex flex-col items-center justify-center h-20 rounded-2xl border-muted"
                onClick={() => handleExport("docx")}
              >
                <FileDown className="h-5 w-5 mb-2" />
                <span className="text-xs">DOCX</span>
              </Button>
              <Button
                variant="outline"
                className="flex-1 flex flex-col items-center justify-center h-20 rounded-2xl  border-muted"
                onClick={() => handleExport("pdf")}
              >
                <FileText className="h-5 w-5 mb-2" />
                <span className="text-xs">PDF</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
