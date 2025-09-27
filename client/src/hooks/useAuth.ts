// Replit Auth hook for user authentication
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface GuestLoginCredentials {
  email: string;
  password: string;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const guestLoginMutation = useMutation({
    mutationFn: async (credentials: GuestLoginCredentials) => {
      const response = await fetch('/api/auth/guest/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Guest login failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate user query to refresh authentication state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    guestLogin: guestLoginMutation,
  };
}