'use client';

import { FolderOpen, Plus, Search, FileText, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function LibraryPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState('bg-blue-500');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetch('/api/backend/collections')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load collections')))
      .then(data => setCollections((data || []).map((item: any) => ({
        ...item,
        paperCount: item.paper_count,
      }))))
      .catch(() => undefined);
  }, []);

  const deleteCollection = async (id: string) => {
    const response = await fetch(`/api/backend/collections/${id}`, { method: 'DELETE' });
    if (response.ok) {
      setCollections(prev => prev.filter(collection => collection.id !== id));
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    setIsCreating(true);
    try {
      const response = await fetch('/api/backend/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCollectionName,
          description: newCollectionDesc,
          color: newCollectionColor,
        }),
      });
      const data = await response.json();
      setCollections(prev => [...prev, data]);
      setShowCreateModal(false);
      setNewCollectionName('');
      setNewCollectionDesc('');
    } catch (e) {
      console.error('Failed to create collection');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Library</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Organize and manage your research collections
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Collection
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <Card key={collection.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={cn('w-3 h-3 rounded-full', collection.color)} />
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500" onClick={() => deleteCollection(collection.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                {collection.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {collection.description}
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  <FileText className="w-3 h-3 mr-1" />
                  {collection.paperCount} papers
                </Badge>
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {collections.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No collections yet</h3>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Create your first collection to organize papers
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Create Collection
            </Button>
          </CardContent>
        </Card>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Collection</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="My Research Collection"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder="What's this collection about?"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex gap-2">
                  {['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCollectionColor(color)}
                      className={cn('w-8 h-8 rounded-full border-2', newCollectionColor === color && 'ring-2 ring-offset-2 ring-primary')}
                    >
                      <div className={cn('w-full h-full rounded-full', color)} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={createCollection} disabled={isCreating} className="flex-1">
                  {isCreating ? 'Creating...' : 'Create Collection'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}