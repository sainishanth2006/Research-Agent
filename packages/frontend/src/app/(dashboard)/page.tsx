'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import Link from 'next/link';
import {
  FileText,
  Search,
  FolderOpen,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@mrdu/shared/utils';

const statDefinitions = [
  { key: 'saved_papers', name: 'Saved Papers', icon: FileText, href: '/library', color: 'bg-blue-500' },
  { key: 'research_projects', name: 'Research Projects', icon: Search, href: '/research', color: 'bg-green-500' },
  { key: 'collections', name: 'Collections', icon: FolderOpen, href: '/library', color: 'bg-purple-500' },
  { key: 'searches', name: 'Searches', icon: Clock, href: '/history', color: 'bg-orange-500' },
];

const quickActions = [
  { name: 'Start Research', description: 'Enter a research question to begin', href: '/research', icon: Search, primary: true },
  { name: 'Upload Paper', description: 'Analyze a PDF from your computer', href: '/upload', icon: FileText },
  { name: 'Create Collection', description: 'Organize your saved papers', href: '/library', icon: FolderOpen },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    authApi.dashboard().then(({ data }) => setStats(data)).catch(() => setStats({}));
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'Researcher'}
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Continue your research journey with AI-powered literature discovery
          </p>
        </div>
        <Link href="/research">
          <Button className="gap-2">
            <Search className="w-4 h-4" />
            New Research
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statDefinitions.map((stat) => (
          <Link key={stat.name} href={stat.href} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{stats[stat.key] ?? 0}</p>
                  </div>
                  <div className={cn('p-3 rounded-xl', stat.color)}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-xl">Quick Actions</CardTitle>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.name} href={action.href} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <action.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">{action.name}</h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-xl">Recent Activity</CardTitle>
          <Link href="/history" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No activity yet</h3>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Start by searching for papers or uploading a PDF
              </p>
              <div className="mt-4 flex gap-2 justify-center">
                <Link href="/research">
                  <Button>
                    <Search className="w-4 h-4 mr-2" />
                    Search Papers
                  </Button>
                </Link>
                <Link href="/upload">
                  <Button variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Upload Paper
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}