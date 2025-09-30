import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import OpusHomePage from "./OpusHomePage";

export default function Login() {
  const { isLoading, isAuthenticated } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, redirect to overview
  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  return <OpusHomePage />;
}