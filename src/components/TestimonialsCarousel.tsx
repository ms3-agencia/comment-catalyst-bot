import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from '@/components/ui/carousel';
import { Star, Quote, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Autoplay from 'embla-carousel-autoplay';

type Testimonial = {
  id: string;
  author_name: string;
  author_role: string | null;
  avatar_url: string | null;
  content: string;
  rating: number;
  result_metric: string | null;
};

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

export const TestimonialsCarousel = () => {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('testimonials')
        .select('id, author_name, author_role, avatar_url, content, rating, result_metric')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('sort_order');
      setItems((data as Testimonial[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Card className="glass p-12 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </Card>
    );
  }

  if (items.length === 0) return null;

  return (
    <Carousel
      opts={{ align: 'start', loop: true }}
      plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
      className="w-full"
    >
      <CarouselContent className="-ml-4">
        {items.map(t => (
          <CarouselItem key={t.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
            <Card className="glass p-6 h-full flex flex-col hover:border-primary/40 transition-all">
              <Quote className="text-primary/40 mb-3" size={28} />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={14} className="fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground/90 flex-1 leading-relaxed">"{t.content}"</p>
              {t.result_metric && (
                <Badge variant="outline" className="mt-4 self-start border-success/40 text-success">
                  <TrendingUp size={12} className="mr-1" /> {t.result_metric}
                </Badge>
              )}
              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border/50">
                <Avatar className="h-10 w-10">
                  {t.avatar_url && <AvatarImage src={t.avatar_url} alt={t.author_name} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {initials(t.author_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-heading text-sm font-bold truncate">{t.author_name}</p>
                  {t.author_role && (
                    <p className="text-xs text-muted-foreground truncate">{t.author_role}</p>
                  )}
                </div>
              </div>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden md:flex -left-4" />
      <CarouselNext className="hidden md:flex -right-4" />
    </Carousel>
  );
};
