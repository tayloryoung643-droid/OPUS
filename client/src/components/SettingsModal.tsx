import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileSettings from "./settings/ProfileSettings";
import IntegrationsSettings from "./settings/IntegrationsSettings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const userPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(userPrefersDark);
  }, []);

  const toggleTheme = (checked: boolean) => {
    setIsDarkMode(checked);
    document.documentElement.classList.toggle('dark', checked);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl bg-[#0f1b34] p-6 text-white border-white/10 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-white/5">
            <TabsTrigger 
              value="profile" 
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
              data-testid="tab-profile"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/70"
              data-testid="tab-integrations"
            >
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-0">
            <ProfileSettings />

            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center py-2">
                <div>
                  <p className="font-medium text-white">Theme</p>
                  <p className="text-sm text-white/70">Switch between dark and light mode</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="theme-toggle" className="flex items-center gap-2 cursor-pointer text-white/70">
                    {isDarkMode ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                    <span className="text-sm">{isDarkMode ? 'Dark' : 'Light'}</span>
                  </Label>
                  <Switch
                    id="theme-toggle"
                    checked={isDarkMode}
                    onCheckedChange={toggleTheme}
                    data-testid="switch-theme"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6">
            <IntegrationsSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}