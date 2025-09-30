import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import RootLayout from "./components/RootLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Agenda from "./pages/Agenda";
import Settings from "./pages/Settings";

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-black via-indigo-900/80 to-violet-900/60 text-white flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
      <p>Loading...</p>
    </div>
  </div>
);

const Protected = ({ element }: { element: JSX.Element }) => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return element;
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "login", element: <Login /> },
      { path: "overview", element: <Protected element={<Overview />} /> },
      { path: "agenda", element: <Protected element={<Agenda />} /> },
      { path: "settings", element: <Protected element={<Settings />} /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ]
  }
]);