import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Search, MessageSquare, Users, TrendingUp, Lightbulb, RefreshCw, Play, Eye, EyeOff } from "lucide-react";

export default function Landing() {
  const [isGuestDialogOpen, setGuestDialogOpen] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { guestLogin } = useAuth();
  
  const isGuestEnabled = import.meta.env.VITE_ENABLE_GUEST === "true";

  const handleSignIn = () => {
    // Redirect to Google Sign-in via Replit Auth
    window.location.href = "/api/login";
  };

  const handleGuestLogin = async () => {
    try {
      await guestLogin.mutateAsync({ email: guestEmail, password: guestPassword });
      setGuestDialogOpen(false);
      toast({
        title: "Welcome to Momentum AI",
        description: "You're now logged in as a guest user with demo data.",
      });
    } catch (error) {
      toast({
        title: "Login Failed", 
        description: error instanceof Error ? error.message : "Invalid guest credentials",
        variant: "destructive",
      });
    }
  };

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
            <Button 
              variant="ghost" 
              onClick={handleSignIn}
              data-testid="button-signin"
            >
              Sign in with Google
            </Button>
            
            {isGuestEnabled && (
              <Dialog open={isGuestDialogOpen} onOpenChange={setGuestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-guest-demo">
                    Try Demo
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Demo Access</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 mb-2">
                        <strong>Demo Credentials:</strong>
                      </p>
                      <p className="text-sm text-blue-700 font-mono">
                        Email: guest@momentum.ai<br />
                        Password: MomentumGuest123!
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="guest-email">Email</Label>
                      <Input
                        id="guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="guest@momentum.ai"
                        data-testid="input-guest-email"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="guest-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="guest-password"
                          type={showPassword ? "text" : "password"}
                          value={guestPassword}
                          onChange={(e) => setGuestPassword(e.target.value)}
                          placeholder="MomentumGuest123!"
                          data-testid="input-guest-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleGuestLogin}
                      disabled={guestLogin.isPending || !guestEmail || !guestPassword}
                      className="w-full"
                      data-testid="button-guest-login"
                    >
                      {guestLogin.isPending ? "Logging in..." : "Access Demo"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            <Link href="/">
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
              <Link href="/">
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
