import { createBrowserRouter, Navigate } from "react-router-dom";
import { getToken } from "./services/authService";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Agenda from "./pages/Agenda";
import Settings from "./pages/Settings";

const Protected = ({ element }: { element: JSX.Element }) =>
  getToken() ? element : <Navigate to="/login" replace />;

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/login", element: <Login /> },
  { path: "/overview", element: <Protected element={<Overview />} /> },
  { path: "/agenda", element: <Protected element={<Agenda />} /> },
  { path: "/settings", element: <Protected element={<Settings />} /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);