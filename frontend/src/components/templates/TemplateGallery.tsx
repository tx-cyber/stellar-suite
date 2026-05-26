'use client';

import React, { useState } from 'react';
import { Search, ExternalLink, Code, Star, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import communityTemplates from '@/data/community-templates.json';

export function TemplateGallery() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'DeFi' | 'Utility' | 'DAO'>('All');

  const filteredTemplates = communityTemplates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenInIDE = (id: string) => {
    // Mock deep-linking API
    window.open(`stellar-suite://open-template/${id}`, '_blank');
  };

  return (
    <section className="py-16 px-4 bg-background border-t border-border">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Community Templates
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Jumpstart your Soroban development with battle-tested contract templates from the community.
            </p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates or tags..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-8">
          {(['All', 'DeFi', 'Utility', 'DAO'] as const).map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              className="rounded-full px-5 transition-all duration-300 font-medium active:scale-95"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-500">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="group hover:shadow-xl hover:border-primary/50 transition-all duration-300">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Code className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span>{template.stars}</span>
                  </div>
                </div>
                <CardTitle className="text-xl">{template.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                  <span>by <span className="text-foreground font-medium">{template.author}</span></span>
                  <span>v{template.version}</span>
                </div>
                <Button 
                  className="w-full group" 
                  onClick={() => handleOpenInIDE(template.id)}
                >
                  <Download className="mr-2 h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                  Open in IDE
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
            <p className="text-muted-foreground text-lg">No templates found matching your search.</p>
            <Button variant="link" onClick={() => setSearch('')}>Clear search</Button>
          </div>
        )}
      </div>
    </section>
  );
}
