import { useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  FileSignature,
  ScrollText,
  Mail,
} from "lucide-react";

const templates = [
  {
    id: 1,
    title: "Non-Disclosure Agreement",
    description: "Standard NDA template for protecting confidential information",
    category: "Contracts",
    icon: FileSignature,
  },
  {
    id: 2,
    title: "Service Agreement",
    description: "Professional services contract template",
    category: "Agreements",
    icon: FileText,
  },
  {
    id: 3,
    title: "Employment Contract",
    description: "Standard employment agreement template",
    category: "Contracts",
    icon: ScrollText,
  },
  {
    id: 4,
    title: "Demand Letter",
    description: "Legal demand letter template",
    category: "Letters",
    icon: Mail,
  },
  {
    id: 5,
    title: "Partnership Agreement",
    description: "Business partnership contract template",
    category: "Agreements",
    icon: FileText,
  },
  {
    id: 6,
    title: "Consulting Agreement",
    description: "Independent contractor agreement template",
    category: "Contracts",
    icon: FileSignature,
  },
];

export default function Templates() {
  const navigate = useNavigate();

  const handleUseTemplate = (templateId: number) => {
    navigate(`/conversation/new?template=${templateId}`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full fade-in">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold font-serif">Legal Templates</h1>
              <p className="text-muted-foreground">Choose from pre-built legal document templates</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="transition-all border-border hover:border-primary/20">
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-foreground/5">
                          <Icon className="h-6 w-6 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">{template.title}</h3>
                          <Badge variant="secondary" className="mb-3">
                            {template.category}
                          </Badge>
                          <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
                          <Button
                            onClick={() => handleUseTemplate(template.id)}
                            className="w-full rounded-full"
                          >
                            Use Template
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
