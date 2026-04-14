import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Download, Loader2, Target, Users, Heart, MessageCircle, Lightbulb, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AiProfileCardProps {
  profile: string;
  projectName?: string;
}

const sectionIcons: Record<string, React.ReactNode> = {
  'perfil do avatar': <Target className="h-5 w-5 text-primary" />,
  'dados demográficos': <Users className="h-5 w-5 text-primary" />,
  'comportamento': <BarChart3 className="h-5 w-5 text-primary" />,
  'engajamento': <BarChart3 className="h-5 w-5 text-primary" />,
  'interesses': <Heart className="h-5 w-5 text-primary" />,
  'temas': <Heart className="h-5 w-5 text-primary" />,
  'dores': <Lightbulb className="h-5 w-5 text-warning" />,
  'necessidades': <Lightbulb className="h-5 w-5 text-warning" />,
  'linguagem': <MessageCircle className="h-5 w-5 text-primary" />,
  'tom': <MessageCircle className="h-5 w-5 text-primary" />,
  'recomendações': <Sparkles className="h-5 w-5 text-warning" />,
  'estratégicas': <Sparkles className="h-5 w-5 text-warning" />,
};

const getIconForHeading = (text: string) => {
  const lower = text.toLowerCase();
  for (const [key, icon] of Object.entries(sectionIcons)) {
    if (lower.includes(key)) return icon;
  }
  return <Sparkles className="h-5 w-5 text-primary" />;
};

export const AiProfileCard = ({ profile, projectName }: AiProfileCardProps) => {
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const element = contentRef.current;
      if (!element) return;

      const opt = {
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename: `${projectName || 'perfil-avatar'}-commentiq.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0a0c10' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF export error:', err);
    }
    setExporting(false);
  };

  return (
    <Card className="overflow-hidden border-primary/20 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">Perfil de Avatar IA</h3>
            {projectName && <p className="text-xs text-muted-foreground">{projectName}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={exporting}
          className="border-primary/30 hover:bg-primary/10"
        >
          {exporting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exportando...</>
          ) : (
            <><Download className="mr-2 h-4 w-4" /> Exportar PDF</>
          )}
        </Button>
      </div>

      {/* Content */}
      <div ref={contentRef} className="ai-profile-content p-6 space-y-1">
        <ReactMarkdown
          components={{
            h2: ({ children }) => (
              <div className="flex items-center gap-3 pt-4 pb-2 first:pt-0">
                {getIconForHeading(String(children))}
                <h2 className="font-heading text-xl font-bold text-foreground">{children}</h2>
              </div>
            ),
            h3: ({ children }) => (
              <div className="flex items-center gap-2 pt-4 pb-1 border-b border-border/50 mb-2">
                {getIconForHeading(String(children))}
                <h3 className="font-heading text-base font-semibold text-foreground">{children}</h3>
              </div>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-relaxed text-muted-foreground pl-1 py-1">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="space-y-1.5 pl-2 py-1">{children}</ul>
            ),
            li: ({ children }) => (
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="leading-relaxed">{children}</span>
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
          }}
        >
          {profile}
        </ReactMarkdown>
      </div>
    </Card>
  );
};
