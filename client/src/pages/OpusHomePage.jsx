import React from "react";

export default function OpusHomePage() {
  // Button handlers - integrated with existing auth system
  const handleSignIn = () => {
    // Redirect to Google Sign-in via Replit Auth
    window.location.href = "/api/login";
  };
  
  const handleSeeDemo = () => {
    // TODO: route to /demo if exists or implement demo flow
    console.log("See Demo clicked");
  };
  
  const handleGetStarted = () => {
    // Same as sign in for now
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="w-32 h-32 rounded-full border-2 border-purple-500 animate-pulse mb-6"></div>
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Your AI Sales Partner
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8">
          Preps, Coaches, and Wins With You.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={handleSignIn}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg"
            data-testid="button-signin-google"
          >
            Sign in with Google
          </button>
          <button 
            onClick={handleSeeDemo}
            className="border border-purple-500 text-purple-400 hover:bg-purple-900 px-6 py-3 rounded-xl font-semibold"
            data-testid="button-see-demo"
          >
            See Demo
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-8 md:px-20 bg-gradient-to-b from-black to-zinc-950">
        <h2 className="text-3xl font-bold text-center mb-12">
          What Opus Brings You
        </h2>
        <div className="grid md:grid-cols-4 gap-8">
          <div className="bg-zinc-900 p-6 rounded-2xl shadow-lg hover:shadow-purple-500/30 transition">
            <h3 className="text-xl font-semibold mb-3">Call Prep Sheets</h3>
            <p className="text-gray-400">
              Automatically pulls Salesforce, Gmail, and Calendar context into one
              actionable prep sheet.
            </p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-2xl shadow-lg hover:shadow-purple-500/30 transition">
            <h3 className="text-xl font-semibold mb-3">Live AI Coaching</h3>
            <p className="text-gray-400">
              Real-time insights and nudges during calls to help you steer
              conversations.
            </p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-2xl shadow-lg hover:shadow-purple-500/30 transition">
            <h3 className="text-xl font-semibold mb-3">Voice Partner (Opus Orb)</h3>
            <p className="text-gray-400">
              Your persistent AE sidekick — always on, always ready to assist via
              voice or chat.
            </p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-2xl shadow-lg hover:shadow-purple-500/30 transition">
            <h3 className="text-xl font-semibold mb-3 text-purple-400">Coming Soon: AI Superpowers</h3>
            <p className="text-gray-400">
              The Whisper. The Foresight. The Shadow. Subtle forces guiding what's next.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Back Below Features */}
      <section className="py-20 px-6 text-center bg-gradient-to-b from-zinc-950 to-black">
        <h2 className="text-4xl font-bold mb-6">
          Win More Deals With Opus in Your Corner
        </h2>
        <button 
          onClick={handleGetStarted}
          className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg"
          data-testid="button-get-started"
        >
          Get Started Free
        </button>
      </section>

      {/* Quotes */}
      <section className="py-16 px-8 md:px-20 text-center space-y-8 max-w-3xl mx-auto">
        <blockquote className="text-xl italic text-gray-300">
          "Opus turns chaos of my sales day into rhythm."
        </blockquote>
        <blockquote className="text-xl italic text-gray-300">
          "With Opus in my corner, it's like I'm always two steps ahead."
        </blockquote>
        <blockquote className="text-xl italic text-gray-300">
          "Opus doesn't just prep me — it makes me feel untouchable on every call."
        </blockquote>
        <blockquote className="text-xl italic text-gray-300">
          "It's like having a secret advantage that no one else in the room can see."
        </blockquote>
        <blockquote className="text-xl italic text-gray-300">
          "It feels like Opus hands me the perfect words at the perfect time."
        </blockquote>
      </section>
    </div>
  );
}