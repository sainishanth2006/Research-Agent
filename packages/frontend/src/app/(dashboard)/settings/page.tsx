'use client';

import { User, Bell, Shield, Palette, Loader2, Save } from 'lucide-react';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    notifications: {
      email: true,
      searchComplete: true,
      weeklyDigest: false,
    },
    appearance: {
      theme: 'system',
      compactMode: false,
    },
    privacy: {
      profileVisibility: 'private',
      analytics: true,
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Settings saved successfully');
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => setSettings({...settings, name: e.target.value})}
                placeholder="Your name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={settings.email}
                onChange={(e) => setSettings({...settings, email: e.target.value})}
                placeholder="your@email.com"
                disabled
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Receive email updates about your research
              </p>
            </div>
            <Switch
              checked={settings.notifications.email}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                notifications: {...settings.notifications, email: checked}
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Search Complete Alerts</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Notify when long searches complete
              </p>
            </div>
            <Switch
              checked={settings.notifications.searchComplete}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                notifications: {...settings.notifications, searchComplete: checked}
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly Digest</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Weekly summary of your research activity
              </p>
            </div>
            <Switch
              checked={settings.notifications.weeklyDigest}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                notifications: {...settings.notifications, weeklyDigest: checked}
              })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Theme</Label>
            <div className="flex gap-4 mt-2">
              {['light', 'dark', 'system'].map(theme => (
                <label
                  key={theme}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors',
                    settings.appearance.theme === theme
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={theme}
                    checked={settings.appearance.theme === theme}
                    onChange={() => setSettings({
                      ...settings,
                      appearance: {...settings.appearance, theme}
                    })}
                    className="sr-only"
                  />
                  <span className="capitalize">{theme}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Compact Mode</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Reduce spacing for more content
              </p>
            </div>
            <Switch
              checked={settings.appearance.compactMode}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                appearance: {...settings.appearance, compactMode: checked}
              })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy & Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Profile Visibility</Label>
            <div className="flex gap-4 mt-2">
              {['private', 'public'].map(v => (
                <label
                  key={v}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors',
                    settings.privacy.profileVisibility === v
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={settings.privacy.profileVisibility === v}
                    onChange={() => setSettings({
                      ...settings,
                      privacy: {...settings.privacy, profileVisibility: v}
                    })}
                    className="sr-only"
                  />
                  <span className="capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Analytics</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Help improve the product with anonymous usage data
              </p>
            </div>
            <Switch
              checked={settings.privacy.analytics}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                privacy: {...settings.privacy, analytics: checked}
              })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            These actions are irreversible. Please proceed with caution.
          </p>
          <div className="flex gap-4">
            <Button variant="destructive" className="flex-1">
              Delete All Data
            </Button>
            <Button variant="destructive" className="flex-1">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}