import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Upload, LogOut } from "lucide-react";

export default function ProfileSettings() {
  const { user } = useAuth();
  
  const firstName = (user as any)?.claims?.first_name || (user as any)?.firstName || "";
  const lastName = (user as any)?.claims?.last_name || (user as any)?.lastName || "";
  const email = (user as any)?.claims?.email || (user as any)?.email || "";
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : firstName || "User";
  const avatarUrl = (user as any)?.claims?.picture || (user as any)?.avatar;

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-white/10 text-white">
            <User className="h-8 w-8" />
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold text-white">{displayName}</h3>
          <p className="text-white/70">{email}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-auto border-white/20 hover:bg-white/5 text-white"
          data-testid="button-upload-avatar"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Photo
        </Button>
      </div>

      {/* Profile Information */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Display Name</label>
          <div className="rounded-lg bg-white/5 p-3 text-white">
            {displayName}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Email Address</label>
          <div className="rounded-lg bg-white/5 p-3 text-white">
            {email}
          </div>
        </div>
        
        <div className="text-sm text-white/50">
          Profile information is synced from your Google account.
        </div>
      </div>

      {/* Account Actions */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">Account Actions</label>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="border-red-500/50 hover:bg-red-500/10 text-red-400 hover:text-red-300"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}