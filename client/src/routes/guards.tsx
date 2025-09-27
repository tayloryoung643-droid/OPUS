import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { useEffect } from "react";

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60 text-white flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
      <p>Loading...</p>
    </div>
  </div>
);

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}

export function PublicGate({ children }: { children: JSX.Element }) {
  // For routes that should be inaccessible when logged in (/, /login)
  const { isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/agenda");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return null;
  }

  return children;
}