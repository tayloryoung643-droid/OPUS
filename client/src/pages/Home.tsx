import { Navigate } from "react-router-dom";
import { getToken } from "../services/authService";
import OpusHomePage from "./OpusHomePage";

export default function Home() {
  // If user is authenticated, redirect to overview
  if (getToken()) {
    return <Navigate to="/overview" replace />;
  }

  return <OpusHomePage />;
}