import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileSettings from "./settings/ProfileSettings";
import IntegrationsSettings from "./settings/IntegrationsSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
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
          
          <TabsContent value="profile" className="mt-6">
            <ProfileSettings />
          </TabsContent>
          
          <TabsContent value="integrations" className="mt-6">
            <IntegrationsSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}