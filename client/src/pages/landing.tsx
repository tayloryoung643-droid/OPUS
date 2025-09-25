import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MessageSquare, Users, TrendingUp, Lightbulb, RefreshCw, Play } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card border-b border-border px-6 py-4" data-testid="navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-semibold text-foreground">Momentum AI</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">Features</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-how-it-works">How It Works</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">Pricing</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-about">About</a>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" data-testid="button-signin">Sign-in</Button>
            <Link href="/dashboard">
              <Button data-testid="button-book-demo">Book Demo</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="gradient-bg py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-white">
            <h1 className="text-5xl font-bold leading-tight mb-6" data-testid="text-hero-title">
              Close More Deals with AI-Powered Call Preparation
            </h1>
            <p className="text-xl text-white/90 mb-8 leading-relaxed" data-testid="text-hero-description">
              Your intelligent sales assistant that researches prospects, analyzes conversations, and prepares personalized strategies in minutes—not hours. Get back a full workday each week.
            </p>
            
            {/* Statistics */}
            <div className="grid grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <div className="text-4xl font-bold mb-2" data-testid="text-stat-research">20%</div>
                <div className="text-sm text-white/80">Time Spent on Research*</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2" data-testid="text-stat-performers">76%</div>
                <div className="text-sm text-white/80">Top Performers Prep*</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2" data-testid="text-stat-conversion">202%</div>
                <div className="text-sm text-white/80">Higher Conversion Rate*</div>
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="bg-white text-primary hover:bg-white/95 font-semibold" data-testid="button-see-action">
                  See It In Action
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" data-testid="button-watch-demo">
                <Play className="mr-2 h-4 w-4" />
                Watch Demo (2 min)
              </Button>
            </div>
          </div>
          
          {/* Right Content - Call Prep Preview */}
          <div className="glass-card rounded-2xl p-1">
            <div className="bg-card rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex space-x-1">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* AI Insight Cards */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">AI Insight</span>
                      <span className="font-medium text-gray-900">Prospect Research Complete</span>
                    </div>
                    <p className="text-gray-700 text-sm">TechCorp just raised $50M Series B. Focus on scaling challenges and integration needs.</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">AI Insight</span>
                      <span className="font-medium text-gray-900">Competitor Analysis</span>
                    </div>
                    <p className="text-gray-700 text-sm">They're evaluating 3 competitors. Emphasize your unique automation features.</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">AI Insight</span>
                      <span className="font-medium text-gray-900">Conversation Strategy</span>
                    </div>
                    <p className="text-gray-700 text-sm">Ask about their Q4 growth targets. Their CEO mentioned aggressive expansion plans.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-16" data-testid="text-features-title">Everything You Need to Win Every Call</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Search className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI Prospect Research</h3>
                <p className="text-muted-foreground">Automatically researches prospects and companies, pulling relevant news, funding, and business insights.</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <MessageSquare className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Conversation Analysis</h3>
                <p className="text-muted-foreground">Analyzes past conversations and CRM history to surface key talking points and next steps.</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Users className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Stakeholder Mapping</h3>
                <p className="text-muted-foreground">Identifies key decision makers and influencers automatically from your CRM and email data.</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <TrendingUp className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Deal Risk Analysis</h3>
                <p className="text-muted-foreground">Surfaces potential risks and opportunities based on deal progression and competitor intelligence.</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Lightbulb className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Smart Recommendations</h3>
                <p className="text-muted-foreground">Provides actionable next steps and conversation strategies tailored to each prospect.</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <RefreshCw className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">CRM Integration</h3>
                <p className="text-muted-foreground">Seamlessly integrates with Salesforce, HubSpot, and other CRM systems for real-time data sync.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
