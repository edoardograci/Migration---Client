import { useState, useEffect } from 'react';
import { notionApi } from '../../api';
import { Loader2, CheckCircle, AlertCircle, Clock, Database, RefreshCcw } from 'lucide-react';
import { Button } from '../ui/button';

const STORAGE_KEY = 'migrator_stats_v1';

interface StatsData {
    designers: {
        total: number;
        published: number;
        migrated: number;
        pending: number;
    };
    moodboard: {
        total: number;
        published: number;
        migrated: number;
        pending: number;
    };
}

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
    return (
        <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">{label}</div>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
}

export function MigrationOverview() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<StatsData | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });
    const [error, setError] = useState<string | null>(null);

    // Initial load if no stats exist
    useEffect(() => {
        if (!stats) fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const [designersData, moodboardData] = await Promise.all([
                notionApi.compareStatus('designers'),
                notionApi.compareStatus('moodboard'),
            ]);

            const newStats = {
                designers: {
                    total: designersData.total,
                    published: designersData.published,
                    migrated: designersData.migrated,
                    pending: designersData.pending,
                },
                moodboard: {
                    total: moodboardData.total,
                    published: moodboardData.published,
                    migrated: moodboardData.migrated,
                    pending: moodboardData.pending,
                },
            };
            setStats(newStats);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
        } catch (err: any) {
            console.error('Failed to fetch stats:', err);
            setError(err.message || 'Failed to fetch migration stats');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !stats) {
        return (
            <div className="flex flex-col items-center justify-center p-16 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Load stats to begin</p>
                <Button onClick={fetchStats}>Load Migration Stats</Button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive">{error}</p>
                <button
                    onClick={fetchStats}
                    className="mt-4 px-4 py-2 border rounded-md hover:bg-muted"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="p-6 space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold mb-2">Migration Dashboard</h1>
                    <p className="text-muted-foreground">
                        Overview of content migration status from Notion to production.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchStats}
                    disabled={loading}
                    className="gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Refresh Stats
                </Button>
            </div>

            {/* Designers Stats */}
            <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Designers Index
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total in Notion"
                        value={stats.designers.total}
                        icon={AlertCircle}
                        color="text-blue-600"
                    />
                    <StatCard
                        label="Published"
                        value={stats.designers.published}
                        icon={CheckCircle}
                        color="text-green-600"
                    />
                    <StatCard
                        label="Live on Site"
                        value={stats.designers.migrated}
                        icon={CheckCircle}
                        color="text-green-600"
                    />
                    <StatCard
                        label="Pending Migration"
                        value={stats.designers.pending}
                        icon={Clock}
                        color="text-yellow-600"
                    />
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>Migration Progress</span>
                        <span>
                            {stats.designers.total > 0
                                ? Math.round((stats.designers.migrated / stats.designers.total) * 100)
                                : 0}%
                        </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 transition-all duration-500"
                            style={{
                                width: `${stats.designers.total > 0
                                    ? (stats.designers.migrated / stats.designers.total) * 100
                                    : 0}%`
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Moodboard Stats */}
            <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Moodboard
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total in Notion"
                        value={stats.moodboard.total}
                        icon={AlertCircle}
                        color="text-blue-600"
                    />
                    <StatCard
                        label="Published"
                        value={stats.moodboard.published}
                        icon={CheckCircle}
                        color="text-green-600"
                    />
                    <StatCard
                        label="Live on Site"
                        value={stats.moodboard.migrated}
                        icon={CheckCircle}
                        color="text-green-600"
                    />
                    <StatCard
                        label="Pending Migration"
                        value={stats.moodboard.pending}
                        icon={Clock}
                        color="text-yellow-600"
                    />
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>Migration Progress</span>
                        <span>
                            {stats.moodboard.total > 0
                                ? Math.round((stats.moodboard.migrated / stats.moodboard.total) * 100)
                                : 0}%
                        </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 transition-all duration-500"
                            style={{
                                width: `${stats.moodboard.total > 0
                                    ? (stats.moodboard.migrated / stats.moodboard.total) * 100
                                    : 0}%`
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="p-4 border rounded-lg bg-muted/30">
                <h3 className="font-medium mb-2">Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">Total Content Items:</span>{' '}
                        <span className="font-medium">{stats.designers.total + stats.moodboard.total}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Total Live:</span>{' '}
                        <span className="font-medium text-green-600">
                            {stats.designers.migrated + stats.moodboard.migrated}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Total Pending:</span>{' '}
                        <span className="font-medium text-yellow-600">
                            {stats.designers.pending + stats.moodboard.pending}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Overall Progress:</span>{' '}
                        <span className="font-medium">
                            {(stats.designers.total + stats.moodboard.total) > 0
                                ? Math.round(
                                    ((stats.designers.migrated + stats.moodboard.migrated) /
                                        (stats.designers.total + stats.moodboard.total)) * 100
                                )
                                : 0}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
