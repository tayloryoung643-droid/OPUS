import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Search, MessageSquare, Users, TrendingUp, Lightbulb, RefreshCw, Play, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function Landing() {
  const [isGuestDialogOpen, setGuestDialogOpen] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { guestLogin, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  
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
        title: "Welcome to Opus",
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

  const handleContinueToDashboard = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60">
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-6 py-4" data-testid="navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Opus Logo Circle */}
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center relative">
              <div className="w-6 h-6 border-2 border-white rounded-full flex items-center justify-center">
                <div className="w-1 h-3 bg-white rounded-full"></div>
                <div className="w-1 h-2 bg-white rounded-full ml-0.5"></div>
                <div className="w-1 h-4 bg-white rounded-full ml-0.5"></div>
              </div>
            </div>
            <span className="text-xl font-semibold text-white">Opus</span>
          </div>
          
          {!isAuthenticated && (
            <div className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-white/70 hover:text-white transition-colors" data-testid="link-features">Features</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors" data-testid="link-how-it-works">How It Works</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors" data-testid="link-pricing">Pricing</a>
              <a href="#" className="text-white/70 hover:text-white transition-colors" data-testid="link-about">About</a>
            </div>
          )}
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <Button 
                onClick={handleContinueToDashboard}
                className="bg-white text-black hover:bg-white/90 font-semibold"
                data-testid="button-continue-dashboard"
              >
                Continue to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={handleSignIn}
                  className="text-white hover:bg-white/10"
                  data-testid="button-signin"
                >
                  Sign in with Google
                </Button>
                
                {isGuestEnabled && (
                  <Dialog open={isGuestDialogOpen} onOpenChange={setGuestDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" data-testid="button-guest-demo">
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
                            Email: guest@opus.ai<br />
                            Password: OpusGuest123!
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="guest-email">Email</Label>
                          <Input
                            id="guest-email"
                            type="email"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            placeholder="guest@opus.ai"
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
                              placeholder="OpusGuest123!"
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
                
                <Button className="bg-white text-black hover:bg-white/90" data-testid="button-book-demo">Book Demo</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          {isAuthenticated ? (
            /* Authenticated User Hero */
            <div className="text-center text-white">
              <h1 className="text-5xl font-bold leading-tight mb-6" data-testid="text-hero-title">
                Welcome back to Opus
              </h1>
              <p className="text-xl text-white/90 mb-8 leading-relaxed max-w-3xl mx-auto" data-testid="text-hero-description">
                Your AI partner is ready to help you prepare for every call. Continue to your dashboard to access today's agenda and insights.
              </p>
              <Button 
                onClick={handleContinueToDashboard}
                size="lg"
                className="bg-white text-black hover:bg-white/90 font-semibold"
                data-testid="button-hero-dashboard"
              >
                Continue to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* Marketing Hero for Unauthenticated Users */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="text-white">
                <h1 className="text-5xl font-bold leading-tight mb-6" data-testid="text-hero-title">
                  Your Emotional AE Partner
                </h1>
                <p className="text-xl text-white/90 mb-8 leading-relaxed" data-testid="text-hero-description">
                  Opus understands your workflow, anticipates your needs, and delivers personalized insights that feel like having a trusted partner by your side.
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
                  <Button 
                    onClick={handleSignIn}
                    size="lg" 
                    className="bg-white text-black hover:bg-white/95 font-semibold" 
                    data-testid="button-see-action"
                  >
                    Get Started with Google
                  </Button>
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" data-testid="button-watch-demo">
                    <Play className="mr-2 h-4 w-4" />
                    Watch Demo (2 min)
                  </Button>
                </div>
              </div>
          
              {/* Right Content - Opus Preview */}
              <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="flex space-x-1">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Opus Insight Cards */}
                  <Card className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 border-blue-400/30">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full">Opus Insight</span>
                        <span className="font-medium text-white">Smart Prep Ready</span>
                      </div>
                      <p className="text-white/80 text-sm">TechCorp just raised $50M Series B. Focus on scaling challenges and integration needs.</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 border-blue-400/30">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full">Opus Insight</span>
                        <span className="font-medium text-white">Emotional Intelligence</span>
                      </div>
                      <p className="text-white/80 text-sm">They're feeling pressure about Q4. Approach with empathy and focus on quick wins.</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 border-blue-400/30">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full">Opus Insight</span>
                        <span className="font-medium text-white">Partner Guidance</span>
                      </div>
                      <p className="text-white/80 text-sm">Your calendar looks intense today. I've prioritized your top 3 calls and prepared context.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Overview - Only show for unauthenticated users */}
      {!isAuthenticated && (
        <section className="py-20 bg-black/20">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-16" data-testid="text-features-title">Everything You Need to Win Every Call</h2>
          
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature Cards */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Search className="text-blue-400 h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">AI Prospect Research</h3>
                  <p className="text-white/70">Automatically researches prospects and companies, pulling relevant news, funding, and business insights.</p>
                </CardContent>
              </Card>
            
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <MessageSquare className="text-blue-400 h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">Emotional Intelligence</h3>
                  <p className="text-white/70">Understands context and emotion in conversations to guide your approach with empathy and insight.</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Users className="text-blue-400 h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">Partner Workflow</h3>
                  <p className="text-white/70">Anticipates your needs and adapts to your workflow, feeling like a trusted team member.</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <TrendingUp className="text-blue-400 h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">Smart Insights</h3>
                  <p className="text-white/70">Delivers personalized insights that help you understand prospects beyond just data points.</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Lightbulb className="text-blue-400 h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">Contextual Guidance</h3>
                  <p className="text-white/70">Provides timely recommendations and nudges that fit naturally into your day.</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <RefreshCw className="text-blue-400 h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">Seamless Integration</h3>
                  <p className="text-white/70">Works with your existing tools and flows, enhancing rather than disrupting your process.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
